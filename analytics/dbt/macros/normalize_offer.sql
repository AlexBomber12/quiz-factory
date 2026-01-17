{% macro normalize_offer_type(product_type) %}
case
  when {{ product_type }} is null then 'unknown'
  when nullif(trim(cast({{ product_type }} as string)), '') is null then 'unknown'
  when lower(trim(cast({{ product_type }} as string))) = 'single' then 'single'
  when lower(trim(cast({{ product_type }} as string))) = 'pack_5' then 'pack_5'
  when lower(trim(cast({{ product_type }} as string))) = 'pack_10' then 'pack_10'
  else 'unknown'
end
{% endmacro %}

{% macro normalize_pack_size(product_type) %}
case
  when {{ product_type }} is null then null
  when nullif(trim(cast({{ product_type }} as string)), '') is null then null
  when lower(trim(cast({{ product_type }} as string))) = 'single' then 1
  when lower(trim(cast({{ product_type }} as string))) = 'pack_5' then 5
  when lower(trim(cast({{ product_type }} as string))) = 'pack_10' then 10
  else null
end
{% endmacro %}
