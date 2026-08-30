"""
WebSocket consumers for real-time operations events.

The OperationsConsumer handles WebSocket connections for the operations dashboard,
ensuring secure, organization-scoped event delivery.
"""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from realtime.events import CHANNEL_GROUP_PREFIX
from realtime.permissions import (
    SUBPROTOCOL_AUTH_PREFIX,
    WebSocketAuthenticationError,
    WebSocketPermissionError,
    authenticate_websocket_connection,
)

logger = logging.getLogger(__name__)


class OperationsConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for organization-scoped operations events.

    Handles:
    - Connection authentication and authorization
    - Organization-scoped group membership
    - Real-time event delivery
    - Connection lifecycle management
    """

    async def connect(self) -> None:
        """
        Handle WebSocket connection.

        Authenticates the user, validates organization access,
        and joins the organization-specific channel group.
        """
        try:
            # Authenticate and authorize the connection
            user, organization, membership = await authenticate_websocket_connection(
                self.scope
            )

            # Store in scope for later use
            self.scope["user"] = user
            self.scope["organization"] = organization
            self.scope["membership"] = membership

            # Generate organization-specific group name
            self.group_name = f"{CHANNEL_GROUP_PREFIX}_{organization.id}"

            # Join the organization's operations group
            await self.channel_layer.group_add(self.group_name, self.channel_name)

            # Echo the offered subprotocol (if any) so the handshake completes
            # cleanly when the JWT was carried as a Sec-WebSocket-Protocol value.
            selected_subprotocol = next(
                (
                    protocol
                    for protocol in self.scope.get("subprotocols", [])
                    if protocol.lower().startswith(SUBPROTOCOL_AUTH_PREFIX)
                ),
                None,
            )

            # Accept the connection
            await self.accept(subprotocol=selected_subprotocol)

            logger.info(
                "WebSocket connection accepted",
                extra={
                    "user_id": str(user.id),
                    "organization_id": str(organization.id),
                    "channel_name": self.channel_name,
                },
            )

        except WebSocketAuthenticationError as e:
            logger.warning(
                "WebSocket authentication failed",
                extra={"code": e.code, "error_message": e.message},
            )
            await self.close(code=4001, reason=e.message)

        except WebSocketPermissionError as e:
            logger.warning(
                "WebSocket authorization failed",
                extra={"code": e.code, "error_message": e.message},
            )
            await self.close(code=4003, reason=e.message)

        except Exception as e:
            logger.exception(
                "WebSocket connection error",
                extra={"error": str(e)},
            )
            await self.close(code=4000, reason="Connection error")

    async def disconnect(self, close_code: int) -> None:
        """
        Handle WebSocket disconnection.

        Removes the client from the organization group.
        """
        try:
            if hasattr(self, "group_name"):
                await self.channel_layer.group_discard(
                    self.group_name, self.channel_name
                )

                logger.info(
                    "WebSocket connection closed",
                    extra={
                        "user_id": str(self.scope.get("user", {}).id),
                        "organization_id": str(self.scope.get("organization", {}).id),
                        "close_code": close_code,
                    },
                )
        except Exception as e:
            logger.exception(
                "Error during WebSocket disconnect",
                extra={"error": str(e)},
            )

    async def receive(self, text_data: str) -> None:
        """
        Handle incoming WebSocket messages.

        Currently this is a server-to-client stream only.
        Client messages are logged but not processed.
        """
        try:
            data = json.loads(text_data)
            logger.info(
                "WebSocket message received (not processed)",
                extra={"data_type": type(data)},
            )
            # Currently we don't process client messages
            # This could be extended for future features
        except json.JSONDecodeError:
            logger.warning("Invalid JSON received from WebSocket client")
        except Exception as e:
            logger.exception(
                "Error processing WebSocket message",
                extra={"error": str(e)},
            )

    async def realtime_event(self, event: dict) -> None:
        """
        Handle real-time events from the channel layer.

        This method is called when an event is published to the
        organization's channel group.
        """
        try:
            # Extract the event data
            event_data = event.get("data")

            if not event_data:
                logger.warning("Received event without data")
                return

            # Send the event to the WebSocket client
            await self.send(text_data=json.dumps(event_data))

        except Exception as e:
            logger.exception(
                "Error sending realtime event to client",
                extra={"error": str(e)},
            )
