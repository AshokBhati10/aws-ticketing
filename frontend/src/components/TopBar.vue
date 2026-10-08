<template>
  <header class="bg-card/95 backdrop-blur-sm border-b border-border sticky top-0 z-30">
    <div class="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button
          @click="$emit('toggle-sidebar')"
          class="lg:hidden p-2 -ml-2 rounded-lg text-text-muted hover:bg-hover hover:text-text transition-colors"
          aria-label="Toggle navigation"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <!-- Page context is rendered by each view; the brand lives in the sidebar -->
        <p class="lg:hidden text-sm font-bold text-brand-600 truncate">TicketDesk</p>
      </div>
      <div class="flex items-center gap-2 sm:gap-3">
        <span
          class="badge"
          :class="role === 'agent' ? 'badge-role-agent' : 'badge-role-customer'"
        >
          {{ role === "agent" ? "Agent" : "Customer" }}
        </span>
        <span class="text-sm text-text-muted hidden md:inline truncate max-w-56" :title="email">{{ email }}</span>
        <span class="hidden sm:block w-px h-6 bg-border" aria-hidden="true"></span>
        <button
          @click="toggle"
          class="p-2 rounded-lg text-text-muted hover:bg-hover hover:text-text transition-colors"
          :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
          :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
        >
          <svg
            v-if="isDark"
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
            />
          </svg>
          <svg
            v-else
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0012 21.75a9.753 9.753 0 009.752-6.748z"
            />
          </svg>
        </button>
        <button @click="logout" class="btn btn-secondary btn-sm">
          <svg class="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          <span class="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref } from "vue";
import { getRole, getUserEmail, logout } from "../lib/auth.js";
import { getTheme, toggleTheme } from "../lib/theme.js";

defineEmits(["toggle-sidebar"]);

const role = getRole();
const email = getUserEmail();

const isDark = ref(getTheme() === "dark");
function toggle() {
  isDark.value = toggleTheme() === "dark";
}
</script>
