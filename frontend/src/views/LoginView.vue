<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
    <div class="card-pad w-full max-w-md text-center">
      <span class="w-14 h-14 rounded-2xl bg-indigo-600 inline-flex items-center justify-center mb-5">
        <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      </span>
      <h1 class="text-2xl font-bold text-slate-900">TicketDesk</h1>
      <p class="text-sm text-slate-500 mt-2 mb-6">
        Sign in securely with your account.<br />
        New here? You can create an account on the next screen.
      </p>
      <button @click="login" class="btn btn-primary w-full">
        Sign in / Sign up
      </button>
      <p class="text-xs text-slate-400 mt-5">
        Authentication is handled by Amazon Cognito.<br />
        We never see or store your password.
      </p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { login } from "../lib/auth.js";

onMounted(() => {
  login(); // /login auto-redirects to the Cognito Hosted UI
});
</script>
