<template>
  <!-- Unauthenticated screens (login / callback): no app shell -->
  <router-view v-if="!isAppRoute" />

  <!-- Authenticated app shell: slim sidebar + top bar + workspace -->
  <div v-else class="min-h-screen bg-page text-text flex">
    <!-- Mobile overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-border',
        'flex flex-col transform transition-transform duration-200',
        'lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      ]"
    >
      <div class="h-16 flex items-center gap-2.5 px-5 border-b border-border shrink-0">
        <span class="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </span>
        <div class="leading-tight">
          <p class="font-bold text-text">TicketDesk</p>
          <p class="text-[11px] text-text-muted">Support ticketing</p>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <p class="nav-section-title pt-0!">Workspace</p>
        <router-link
          v-for="item in navItems"
          :key="item.id"
          :to="item.to"
          class="nav-link mb-0.5"
          :class="{ 'nav-link-active': item.match(route) }"
          @click="sidebarOpen = false"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
          <span class="truncate">{{ item.label }}</span>
          <span
            v-if="item.count !== undefined"
            class="ml-auto text-[11px] font-semibold bg-hover text-text-muted rounded-full px-2 py-0.5"
          >
            {{ item.count }}
          </span>
        </router-link>

        <template v-if="categories.length">
          <p class="nav-section-title">Categories</p>
          <router-link
            v-for="c in categories"
            :key="c"
            :to="{ path: '/', query: { category: c } }"
            class="nav-link mb-0.5"
            :class="{ 'nav-link-active': route.query.category === c }"
            @click="sidebarOpen = false"
          >
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5.586a1 1 0 01.707.293l7.414 7.414a1 1 0 010 1.414l-5.586 5.586a1 1 0 01-1.414 0L5.293 10.293A1 1 0 015 9.586V4a1 1 0 011-1z" />
            </svg>
            <span class="truncate">{{ c }}</span>
          </router-link>
        </template>
      </nav>

      <div class="p-4 border-t border-border shrink-0">
        <p class="text-[11px] text-text-faint leading-relaxed">
          Signed in as<br />
          <span class="font-medium text-text-muted break-all">{{ email }}</span>
        </p>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0 min-h-screen">
      <TopBar @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <router-view @categories="categories = $event" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import TopBar from "./components/TopBar.vue";
import { getRole, getUserEmail } from "./lib/auth.js";

const route = useRoute();
const sidebarOpen = ref(false);
const categories = ref([]);
const email = getUserEmail();

const isAppRoute = computed(() => !!route.meta.requiresAuth);

const ICONS = {
  dashboard:
    "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  ticket:
    "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  inbox:
    "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
  open: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  progress: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  resolved: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
};

const hasNoView = (r) => !r.query.view && !r.query.status && !r.query.category;

const navItems = computed(() => {
  const role = getRole();
  const items = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: ICONS.dashboard,
      to: "/",
      match: (r) => r.path === "/" && hasNoView(r),
    },
    {
      id: "all",
      label: "All Tickets",
      icon: ICONS.ticket,
      to: { path: "/", query: { view: "all" } },
      match: (r) => r.path === "/" && r.query.view === "all",
    },
  ];
  if (role === "agent") {
    items.push(
      {
        id: "mine",
        label: "My Tickets",
        icon: ICONS.user,
        to: { path: "/", query: { view: "mine" } },
        match: (r) => r.query.view === "mine",
      },
      {
        id: "unassigned",
        label: "Unassigned",
        icon: ICONS.inbox,
        to: { path: "/", query: { view: "unassigned" } },
        match: (r) => r.query.view === "unassigned",
      }
    );
  } else {
    items.push({
      id: "mine",
      label: "My Tickets",
      icon: ICONS.user,
      to: "/",
      match: (r) => r.path === "/" && hasNoView(r),
    });
  }
  items.push(
    {
      id: "open",
      label: "Open",
      icon: ICONS.open,
      to: { path: "/", query: { status: "open" } },
      match: (r) => r.query.status === "open" && !r.query.view,
    },
    {
      id: "progress",
      label: "In Progress",
      icon: ICONS.progress,
      to: { path: "/", query: { status: "in-progress" } },
      match: (r) => r.query.status === "in-progress" && !r.query.view,
    },
    {
      id: "resolved",
      label: "Resolved",
      icon: ICONS.resolved,
      to: { path: "/", query: { status: "resolved" } },
      match: (r) => r.query.status === "resolved" && !r.query.view,
    }
  );
  return items;
});
</script>
