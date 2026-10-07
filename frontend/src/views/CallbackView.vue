<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <p v-if="error" class="text-red-600 mb-4">{{ error }}</p>
      <p v-else class="text-gray-600">Completing sign-in…</p>
      <router-link v-if="error" to="/login" class="text-indigo-600 underline">
        Back to sign-in
      </router-link>
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
