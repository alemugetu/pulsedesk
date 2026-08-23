from audit_logs import views
from django.urls import path

app_name = "audit_logs"

urlpatterns = [
    # Audit log list (read-only, paginated, filterable)
    path(
        "audit-logs/",
        views.AuditLogListView.as_view(),
        name="audit-log-list",
    ),
    # Audit log detail (read-only, scoped to organization)
    path(
        "audit-logs/<uuid:audit_log_id>/",
        views.AuditLogDetailView.as_view(),
        name="audit-log-detail",
    ),
]
