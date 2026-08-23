"""
Report Permissions — Phase 13.5

RBAC permission classes for operational reporting.
"""

from organizations.permissions import RequiresPermission


class CanViewReports(RequiresPermission):
    """
    Permission requirement for report access.

    Operational reporting access requires 'report.view' permission.
    This provides granular control separate from dashboard access.
    """

    required_permission = "report.view"
