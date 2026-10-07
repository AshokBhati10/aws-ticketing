<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="card-pad w-full max-w-md text-center">
      <div v-if="error">
        <p class="alert-error mb-4">{{ error }}</p>
        <router-link to="/login" class="btn btn-primary w-full">Back to sign-in</router-link>
      </div>
      <div v-else>
        <span class="spinner !w-8 !h-8 mb-4"></span>
        <p class="text-sm font-medium text-slate-600">Completing sign-in…</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { handleCallback } from "../lib/auth.js";

const router = useRouter();
const error = ref("");

onMounted(async () => {
  try {
    await handleCallback();
    router.replace("/");
  } catch (e) {
    error.value = e.message;
  }
});
</script>
