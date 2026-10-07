<template>
  <span class="badge" :class="cls">{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ type: String, value: String });

const STATUS_CLASSES = {
  open: "badge-open",
  "in-progress": "badge-in-progress",
  resolved: "badge-resolved",
  closed: "badge-closed",
};
const PRIORITY_CLASSES = {
  low: "badge-low",
  medium: "badge-medium",
  high: "badge-high",
  urgent: "badge-urgent",
};

const cls = computed(() =>
  props.type === "status"
    ? STATUS_CLASSES[props.value] || "badge-closed"
    : PRIORITY_CLASSES[props.value] || "badge-low"
);
const label = computed(() => props.value);
</script>
