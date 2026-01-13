{% set allowed_schemas = ["tmp", "marts"] %}
{% set model_names = [] %}
{% for node in graph.nodes.values()
  if node.resource_type == "model"
  and node.config.materialized != "ephemeral"
  and node.config.enabled %}
  {% do model_names.append(node.alias) %}
{% endfor %}

{% if model_names | length == 0 %}
select 1 where false
{% else %}
{% set location = (target.location if target.location is not none else "EU") | lower %}
{% set info_schema = target.project ~ ".region-" ~ location ~ ".INFORMATION_SCHEMA.TABLES" %}
select
  table_schema,
  table_name,
  table_type
from `{{ info_schema }}`
where lower(table_schema) not in ('{{ allowed_schemas | join("','") }}')
  and table_name in ('{{ model_names | join("','") }}')
  and table_type in ('BASE TABLE', 'VIEW', 'MATERIALIZED VIEW')
{% endif %}
