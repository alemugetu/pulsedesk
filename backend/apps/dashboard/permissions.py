from organizations.permissions import RequiresPermission


class CanViewDashboard(RequiresPermission):
    """
    Permission requirement for dashboard access.

    Operational dashboard access requires 'incident.view' permission.
    Additional granular checks (SLA, Escalation) can be derived from this
    base requirement or extended if the RBAC model grows.
    """

    required_permission = "incident.view"
