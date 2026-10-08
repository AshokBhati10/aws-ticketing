<template>
  <span class="badge" :class="cls">
    <span v-if="dot" class="badge-dot" :class="dotCls" aria-hidden="true"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  type: String, // "status" | "priority" | "role"
  value: String,
  dot: { type: Boolean, default: false }, // show a semantic status dot
});

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
const ROLE_CLASSES = {
  agent: "badge-role-agent",
  customer: "badge-role-customer",
};

// Solid dot colors that stay readable on both themes.
const DOT_CLASSES = {
  open: "bg-amber-500",
  "in-progress": "bg-blue-500",
  resolved: "bg-emerald-500",
  closed: "bg-slate-400",
  low: "bg-slate-400",
  medium: "bg-indigo-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const cls = computed(() => {
  if (props.type === "status") return STATUS_CLASSES[props.value] || "badge-closed";
  if (props.type === "role") return ROLE_CLASSES[props.value] || "badge-role-customer";
  return PRIORITY_CLASSES[props.value] || "badge-low";
});
const dotCls = computed(() => DOT_CLASSES[props.value] || "bg-slate-400");
const label = computed(() => props.value);
</script>
