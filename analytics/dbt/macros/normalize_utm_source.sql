{% macro normalize_utm_source(source_value) %}
case
  when {{ source_value }} is null then null
  when nullif(trim(cast({{ source_value }} as string)), '') is null then null
  when lower(trim(cast({{ source_value }} as string))) in ('facebook', 'instagram')
    then 'meta'
  else lower(trim(cast({{ source_value }} as string)))
end
{% endmacro %}
