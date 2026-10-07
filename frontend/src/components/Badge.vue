<template>
  <span class="text-xs font-semibold px-2 py-1 rounded-full" :class="cls">{{ label }}</span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({ type: String, value: String });

const STATUS_COLORS = {
  open: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-200 text-gray-700",
};
const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-indigo-100 text-indigo-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const cls = computed(() =>
  props.type === "status"
    ? STATUS_COLORS[props.value] || "bg-gray-100 text-gray-700"
    : PRIORITY_COLORS[props.value] || "bg-gray-100 text-gray-700"
);
const label = computed(() => props.value);
</script>
