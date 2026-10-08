<template>
  <div class="min-h-screen bg-page flex items-center justify-center px-4">
    <div class="card-pad w-full max-w-md text-center">
      <div v-if="error">
        <span class="w-12 h-12 rounded-2xl bg-badge-urgent-bg text-badge-urgent-text inline-flex items-center justify-center mb-4">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <p class="alert-error mb-4 text-left">{{ error }}</p>
        <router-link to="/login" class="btn btn-primary w-full">Back to sign-in</router-link>
      </div>
      <div v-else>
        <span class="w-12 h-12 rounded-2xl bg-brand-600 inline-flex items-center justify-center mb-5">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </span>
        <div class="flex items-center justify-center gap-3 mb-2">
          <span class="spinner !w-5 !h-5"></span>
          <p class="text-sm font-semibold text-text">Completing sign-in…</p>
        </div>
        <p class="text-xs text-text-faint">Verifying your credentials with Amazon Cognito</p>
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
