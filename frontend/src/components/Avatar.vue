<template>
  <span class="avatar" :class="sizeClass" :title="name" aria-hidden="true">
    {{ initial }}
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  name: { type: String, default: "" },
  size: { type: String, default: "md" }, // xs | sm | md | lg
});

const SIZES = {
  xs: "w-5 h-5 text-[10px]",
  sm: "w-6 h-6 text-[11px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

const sizeClass = computed(() => SIZES[props.size] || SIZES.md);
const initial = computed(() => {
  const n = (props.name || "").trim();
  return n ? n.charAt(0).toUpperCase() : "?";
});
</script>
