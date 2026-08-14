from django.apps import AppConfig


class CommonConfig(AppConfig):
    name = "common"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from config.celery import app

        app.autodiscover_tasks(force=True)
