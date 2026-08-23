from attachments import views
from django.urls import path

app_name = "attachments"

urlpatterns = [
    # Attachment list / upload for an incident
    path(
        "incidents/<uuid:incident_id>/attachments/",
        views.AttachmentListCreateView.as_view(),
        name="attachment-list",
    ),
    # Authorized file download
    path(
        "incidents/<uuid:incident_id>/attachments/<uuid:attachment_id>/download/",
        views.AttachmentDownloadView.as_view(),
        name="attachment-download",
    ),
    # Delete attachment
    path(
        "incidents/<uuid:incident_id>/attachments/<uuid:attachment_id>/",
        views.AttachmentDeleteView.as_view(),
        name="attachment-detail",
    ),
]
