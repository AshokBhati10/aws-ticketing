<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold mb-2">Ticketing POC</h1>
      <p class="text-gray-600 mb-6">Redirecting to sign-in…</p>
      <button
        @click="login"
        class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Sign in
      </button>
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
