from comments import views
from django.urls import path

app_name = "comments"

urlpatterns = [
    # Comments list / create for an incident
    path(
        "incidents/<uuid:incident_id>/comments/",
        views.CommentListCreateView.as_view(),
        name="comment-list",
    ),
    # Comment detail / update / delete
    path(
        "incidents/<uuid:incident_id>/comments/<uuid:comment_id>/",
        views.CommentDetailView.as_view(),
        name="comment-detail",
    ),
]
