<template>
  <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-text tracking-tight">{{ pageTitle }}</h1>
        <p class="text-sm text-text-muted mt-1">{{ pageDescription }}</p>
      </div>
      <router-link to="/tickets/new" class="btn btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New ticket
      </router-link>
    </div>

    <!-- Statistics (computed from the real unfiltered dataset) -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <router-link
        v-for="s in statCards"
        :key="s.key"
        :to="s.to"
        class="stat-card stat-card-link"
        :aria-label="`${s.label}: ${statsLoading ? 'loading' : s.value}`"
      >
        <span class="stat-icon" :class="s.iconClass">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" :d="s.icon" />
          </svg>
        </span>
        <div class="min-w-0">
          <p class="stat-value">{{ statsLoading ? "–" : s.value }}</p>
          <p class="stat-label truncate">{{ s.label }}</p>
        </div>
      </router-link>
    </div>

    <!-- Search + filters -->
    <div class="toolbar mb-4">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="relative flex-1">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Search by title or category…"
            aria-label="Search tickets"
            class="input pl-9"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-text-muted">
            <span class="sr-only sm:not-sr-only">Status</span>
            <select v-model="filters.status" @change="onFilterChange" class="select" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm text-text-muted">
            <span class="sr-only sm:not-sr-only">Priority</span>
            <select v-model="filters.priority" @change="onPriorityChange" class="select" aria-label="Filter by priority">
              <option value="">All priorities</option>
              <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
        </div>
      </div>

      <!-- Active filter chips: makes the current result set obvious -->
      <div v-if="filterChips.length" class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
        <span class="text-xs text-text-faint font-medium">Active:</span>
        <span v-for="chip in filterChips" :key="chip.key" class="chip">
          {{ chip.label }}
          <button
            type="button"
            class="chip-x"
            @click="removeFilter(chip.kind)"
            :aria-label="`Remove ${chip.label} filter`"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
        <button type="button" @click="clearFilters" class="text-xs text-brand-600 hover:text-brand-500 font-semibold ml-1">
          Clear all
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <div v-if="error" class="p-6">
        <p class="alert-error">{{ error }}</p>
        <button @click="load" class="btn btn-secondary btn-sm mt-3">Retry</button>
      </div>

      <div v-else-if="loading" class="p-4 sm:p-6 space-y-3" aria-label="Loading tickets">
        <div v-for="i in 8" :key="i" class="skeleton-row h-12"></div>
      </div>

      <div v-else-if="displayedTickets.length === 0" class="empty-state">
        <svg class="w-12 h-12 mx-auto text-border-strong" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
        <p class="empty-state-title">No tickets found</p>
        <p class="empty-state-text">
          {{ hasActiveFilters ? "Try adjusting your search or filters." : "Create your first ticket to get started." }}
        </p>
        <router-link v-if="!hasActiveFilters" to="/tickets/new" class="btn btn-primary mt-4">
          New ticket
        </router-link>
        <button v-else @click="clearFilters" class="btn btn-secondary mt-4">
          Clear filters
        </button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="tbl min-w-[820px]">
          <thead>
            <tr>
              <th scope="col">Ticket ID</th>
              <th scope="col">Title</th>
              <th v-if="role === 'agent'" scope="col">Customer</th>
              <th scope="col">Category</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th v-if="role === 'agent'" scope="col">Assignee</th>
              <th scope="col" class="text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in pagedTickets"
              :key="t.ticketId"
              class="clickable"
              @click="$router.push(`/tickets/${t.ticketId}`)"
              @keydown.enter="$router.push(`/tickets/${t.ticketId}`)"
              tabindex="0"
              :aria-label="`Open ticket ${t.title}`"
            >
              <td class="font-mono text-xs text-text-muted whitespace-nowrap">#{{ shortId(t.ticketId) }}</td>
              <td class="font-medium text-text max-w-72">
                <span class="block truncate" :title="t.title">{{ t.title }}</span>
              </td>
              <td v-if="role === 'agent'" class="whitespace-nowrap">
                <span class="inline-flex items-center gap-2 max-w-52">
                  <Avatar :name="t.customerEmail" size="xs" />
                  <span class="truncate text-sm text-text-muted" :title="t.customerEmail">{{ t.customerEmail }}</span>
                </span>
              </td>
              <td class="text-text-muted whitespace-nowrap text-[13px]">{{ t.category }}</td>
              <td><Badge type="priority" :value="t.priority" dot /></td>
              <td><Badge type="status" :value="t.status" dot /></td>
              <td v-if="role === 'agent'" class="whitespace-nowrap">
                <span v-if="t.assignee" class="inline-flex items-center gap-2 max-w-48">
                  <Avatar :name="t.assignee" size="xs" />
                  <span class="truncate text-sm text-text" :title="t.assignee">{{ t.assignee }}</span>
                </span>
                <span v-else class="text-xs text-text-faint italic">Unassigned</span>
              </td>
              <td class="text-text-muted text-xs whitespace-nowrap text-right tabular-nums">{{ formatDate(t.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="!loading && !error && displayedTickets.length > 0"
        class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-2"
      >
        <p class="text-xs text-text-muted tabular-nums">
          Showing {{ pageStart }}–{{ pageEnd }} of {{ displayedTickets.length }} ticket{{ displayedTickets.length === 1 ? "" : "s" }}
        </p>
        <nav class="flex items-center gap-1" aria-label="Ticket pages">
          <button class="page-btn" :disabled="page === 1" @click="gotoPage(page - 1)" aria-label="Previous page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <template v-for="p in pageNumbers" :key="p === '…' ? `gap-${p}` : p">
            <span v-if="p === '…'" class="px-1 text-text-faint text-sm" aria-hidden="true">…</span>
            <button
              v-else
              class="page-btn"
              :class="{ 'page-btn-active': p === page }"
              @click="gotoPage(p)"
              :aria-label="`Page ${p}`"
              :aria-current="p === page ? 'page' : undefined"
            >
              {{ p }}
            </button>
          </template>
          <button class="page-btn" :disabled="page === totalPages" @click="gotoPage(page + 1)" aria-label="Next page">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Badge from "../components/Badge.vue";
import Avatar from "../components/Avatar.vue";
import { api } from "../lib/api.js";
import { getRole, getUserEmail } from "../lib/auth.js";

const emit = defineEmits(["categories"]);

const route = useRoute();
const router = useRouter();
const role = getRole();
const userEmail = getUserEmail();

const statuses = ["open", "in-progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];
const PAGE_SIZE = 20;

const filters = reactive({ status: "", priority: "" });
const search = ref("");
const page = ref(1);
const tickets = ref([]); // API-filtered (status/priority) ticket list for the table
const statsTickets = ref([]); // unfiltered ticket list for the stat cards
const loading = ref(true);
const statsLoading = ref(true);
const error = ref("");

// ---- derived view state from the URL query (sidebar navigation) ----
const view = computed(() => route.query.view || "");
const categoryFilter = computed(() => route.query.category || "");

const pageTitle = computed(() => {
  if (view.value === "mine") return role === "agent" ? "My Tickets" : "Tickets";
  if (view.value === "unassigned") return "Unassigned Tickets";
  if (view.value === "all") return "All Tickets";
  if (filters.status) return `${capitalize(filters.status)} Tickets`;
  if (categoryFilter.value) return `${categoryFilter.value} Tickets`;
  return role === "agent" ? "Dashboard" : "Tickets";
});

const pageDescription = computed(() =>
  role === "agent"
    ? "Track, assign and resolve every ticket in the queue."
    : "View and manage your support tickets."
);

// ---- statistics (computed from the unfiltered dataset, never hardcoded) ----
const stats = computed(() => {
  const all = statsTickets.value;
  return {
    total: all.length,
    open: all.filter((t) => t.status === "open").length,
    inProgress: all.filter((t) => t.status === "in-progress").length,
    resolved: all.filter((t) => t.status === "resolved").length,
  };
});

const statCards = computed(() => [
  {
    key: "total",
    label: "Total tickets",
    value: stats.value.total,
    to: "/",
    iconClass: "bg-brand-100 text-brand-700",
    icon: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  },
  {
    key: "open",
    label: "Open",
    value: stats.value.open,
    to: { path: "/", query: { status: "open" } },
    iconClass: "bg-badge-open-bg text-badge-open-text",
    icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "inProgress",
    label: "In progress",
    value: stats.value.inProgress,
    to: { path: "/", query: { status: "in-progress" } },
    iconClass: "bg-badge-progress-bg text-badge-progress-text",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    key: "resolved",
    label: "Resolved",
    value: stats.value.resolved,
    to: { path: "/", query: { status: "resolved" } },
    iconClass: "bg-badge-resolved-bg text-badge-resolved-text",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
]);

// ---- active filter chips ----
const filterChips = computed(() => {
  const chips = [];
  if (view.value === "mine") chips.push({ key: "view", kind: "view", label: role === "agent" ? "Assigned to me" : "My tickets" });
  if (view.value === "unassigned") chips.push({ key: "view", kind: "view", label: "Unassigned" });
  if (view.value === "all") chips.push({ key: "view", kind: "view", label: "All tickets" });
  if (filters.status) chips.push({ key: "status", kind: "status", label: `Status: ${filters.status}` });
  if (filters.priority) chips.push({ key: "priority", kind: "priority", label: `Priority: ${filters.priority}` });
  if (categoryFilter.value) chips.push({ key: "category", kind: "category", label: `Category: ${categoryFilter.value}` });
  if (search.value.trim()) chips.push({ key: "search", kind: "search", label: `“${search.value.trim()}”` });
  return chips;
});

const hasActiveFilters = computed(() => filterChips.value.length > 0);

// ---- table rows: API filters first, then client-side view/category/search ----
const displayedTickets = computed(() => {
  let list = tickets.value;
  if (view.value === "mine" && role === "agent") {
    list = list.filter((t) => t.assignee === userEmail);
  } else if (view.value === "unassigned") {
    list = list.filter((t) => !t.assignee);
  }
  if (categoryFilter.value) {
    list = list.filter((t) => t.category === categoryFilter.value);
  }
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q)
    );
  }
  return list;
});

// ---- pagination (presentation only, over the existing filtered list) ----
const totalPages = computed(() =>
  Math.max(1, Math.ceil(displayedTickets.value.length / PAGE_SIZE))
);
const pagedTickets = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE;
  return displayedTickets.value.slice(start, start + PAGE_SIZE);
});
const pageStart = computed(() =>
  displayedTickets.value.length === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1
);
const pageEnd = computed(() =>
  Math.min(page.value * PAGE_SIZE, displayedTickets.value.length)
);
const pageNumbers = computed(() => {
  const total = totalPages.value;
  const cur = page.value;
  const set = new Set([1, total]);
  for (let p = cur - 1; p <= cur + 1; p++) {
    if (p > 1 && p < total) set.add(p);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
});

function gotoPage(p) {
  page.value = Math.min(Math.max(1, p), totalPages.value);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shortId(id) {
  return (id || "").slice(0, 8);
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function syncFiltersFromQuery() {
  // Sidebar status links drive the API-level status filter.
  filters.status = route.query.status || "";
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.listTickets({
      status: filters.status,
      priority: filters.priority,
    });
    tickets.value = data.tickets || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  try {
    const data = await api.listTickets({});
    statsTickets.value = data.tickets || [];
    const cats = [...new Set(statsTickets.value.map((t) => t.category).filter(Boolean))].sort();
    emit("categories", cats);
  } catch {
    // Stats are best-effort; the table load surfaces real errors.
  } finally {
    statsLoading.value = false;
  }
}

function onFilterChange() {
  // Keep the URL as the source of truth for the status filter.
  const query = { ...route.query };
  if (filters.status) query.status = filters.status;
  else delete query.status;
  page.value = 1;
  router.replace({ path: "/", query });
}

function onPriorityChange() {
  page.value = 1;
  load();
}

function removeFilter(kind) {
  if (kind === "status") {
    const query = { ...route.query };
    delete query.status;
    router.replace({ path: "/", query });
  } else if (kind === "priority") {
    filters.priority = "";
    load();
  } else if (kind === "search") {
    search.value = "";
  } else if (kind === "view" || kind === "category") {
    const query = { ...route.query };
    delete query[kind];
    router.replace({ path: "/", query });
  }
  page.value = 1;
}

function clearFilters() {
  search.value = "";
  filters.priority = "";
  filters.status = "";
  page.value = 1;
  router.replace({ path: "/" });
}

watch(search, () => {
  page.value = 1;
});

watch(displayedTickets, () => {
  if (page.value > totalPages.value) page.value = totalPages.value;
});

watch(
  () => route.query,
  () => {
    syncFiltersFromQuery();
    page.value = 1;
    load();
  }
);

onMounted(() => {
  syncFiltersFromQuery();
  load();
  loadStats();
});
</script>
