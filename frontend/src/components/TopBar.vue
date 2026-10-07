<template>
  <header class="bg-white border-b">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <router-link to="/" class="text-lg font-bold text-indigo-700">Ticketing POC</router-link>
      <div class="flex items-center gap-3">
        <span
          class="text-xs font-semibold px-2 py-1 rounded-full"
          :class="role === 'agent' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'"
        >
          {{ role === "agent" ? "Agent" : "Customer" }}
        </span>
        <span class="text-sm text-gray-600 hidden sm:inline">{{ email }}</span>
        <button
          @click="logout"
          class="text-sm px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200"
        >
          Sign out
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { getRole, getUserEmail, logout } from "../lib/auth.js";

const role = getRole();
const email = getUserEmail();
</script>
