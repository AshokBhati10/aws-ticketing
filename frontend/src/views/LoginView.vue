<template>
  <div class="min-h-screen bg-page flex">
    <!-- Brand panel -->
    <div class="hidden lg:flex lg:w-[44%] xl:w-[46%] bg-panel-brand text-panel-brand-text flex-col justify-between p-12 shrink-0">
      <div class="flex items-center gap-3">
        <span class="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
          <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </span>
        <div class="leading-tight">
          <p class="font-bold text-white text-lg">TicketDesk</p>
          <p class="text-xs text-panel-brand-muted">Enterprise support ticketing</p>
        </div>
      </div>

      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight leading-snug">
          Customer support,<br />minus the chaos.
        </h2>
        <p class="text-sm text-panel-brand-muted mt-4 max-w-sm leading-relaxed">
          Track every request, resolve issues faster, and keep customers in the
          loop — all from one secure workspace.
        </p>
        <ul class="mt-8 space-y-4 text-sm">
          <li v-for="f in features" :key="f" class="flex items-start gap-3">
            <span class="w-6 h-6 rounded-full bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="text-panel-brand-text/90">{{ f }}</span>
          </li>
        </ul>
      </div>

      <p class="text-xs text-panel-brand-muted">
        Powered by AWS serverless · Secured by Amazon Cognito
      </p>
    </div>

    <!-- Sign-in card -->
    <div class="flex-1 flex items-center justify-center px-4 py-10">
      <div class="card-pad w-full max-w-md">
        <span class="w-14 h-14 rounded-2xl bg-brand-600 inline-flex items-center justify-center mb-5 lg:hidden">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </span>
        <h1 class="text-2xl font-bold text-text tracking-tight">Welcome to TicketDesk</h1>
        <p class="text-sm text-text-muted mt-2 mb-6">
          Sign in securely with your account.<br />
          New here? You can create an account on the next screen.
        </p>
        <button @click="login" class="btn btn-primary w-full" autofocus>
          Sign in / Sign up
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5-5 5M6 12h12" />
          </svg>
        </button>
        <div class="flex items-center gap-2 mt-6 pt-5 border-t border-border">
          <svg class="w-4 h-4 text-text-faint shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p class="text-xs text-text-faint leading-relaxed">
            Authentication is handled by Amazon Cognito.<br />
            We never see or store your password.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { login } from "../lib/auth.js";

const features = [
  "Submit and track support tickets in real time",
  "Attach files and follow every conversation",
  "Role-based access for customers and agents",
];

onMounted(() => {
  login(); // /login auto-redirects to the Cognito Hosted UI
});
</script>
