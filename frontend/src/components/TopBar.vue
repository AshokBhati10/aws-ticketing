<template>
  <header class="bg-white border-b border-slate-200 sticky top-0 z-30">
    <div class="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button
          @click="$emit('toggle-sidebar')"
          class="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <!-- Page context is rendered by each view; the brand lives in the sidebar -->
        <p class="lg:hidden text-sm font-bold text-indigo-700 truncate">TicketDesk</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="badge"
          :class="role === 'agent' ? 'badge-role-agent' : 'badge-role-customer'"
        >
          {{ role === "agent" ? "Agent" : "Customer" }}
        </span>
        <span class="text-sm text-slate-600 hidden md:inline truncate max-w-56">{{ email }}</span>
        <button @click="logout" class="btn btn-secondary btn-sm">Sign out</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { getRole, getUserEmail, logout } from "../lib/auth.js";

defineEmits(["toggle-sidebar"]);

const role = getRole();
const email = getUserEmail();
</script>
