"""
Phase 9 — SLA monitoring composite indexes.

The SLA monitoring task (sla.monitor_sla) performs a cross-org query that
joins incidents with their IncidentSLA records and filters on breach state.
The existing single-column indexes on response_deadline / resolution_deadline
are insufficient for the monitoring query pattern, which filters on:

  incident.status IN ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS')
  AND incident.sla IS NOT NULL

After evaluate_sla_status() marks a breach, a subsequent monitoring pass
needs to efficiently find already-breached SLAs (response_breached=TRUE or
resolution_breached=TRUE) to re-run escalation evaluation.

New indexes:

  incident_slas (response_breached, response_deadline)
    — Efficiently locate un-evaluated response breaches.

  incident_slas (resolution_breached, resolution_deadline)
    — Efficiently locate un-evaluated resolution breaches.

  incidents (status, organization)
    — This index already exists as (organization, status); the monitoring
      query filters by status first across all orgs.  The existing index
      covers this via its leading column.  No new index needed here.

These indexes are additive — they do not modify any existing data or constraints.
"""

from typing import ClassVar

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies: ClassVar = [
        ("sla", "0001_initial"),
    ]

    operations: ClassVar = [
        # Composite index: quickly find SLA records where response is breached,
        # ordered by deadline for time-based iteration.
        migrations.AddIndex(
            model_name="incidentsla",
            index=models.Index(
                fields=["response_breached", "response_deadline"],
                name="isla_resp_breach_dl_idx",
            ),
        ),
        # Composite index: quickly find SLA records where resolution is breached.
        migrations.AddIndex(
            model_name="incidentsla",
            index=models.Index(
                fields=["resolution_breached", "resolution_deadline"],
                name="isla_resol_breach_dl_idx",
            ),
        ),
    ]
