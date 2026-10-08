<template>
  <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ pageTitle }}</h1>
        <p class="text-sm text-text-muted mt-1">{{ pageDescription }}</p>
      </div>
      <router-link to="/tickets/new" class="btn btn-primary">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        New ticket
      </router-link>
    </div>

    <!-- Statistics -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <div class="stat-card">
        <span class="stat-icon bg-brand-100 text-brand-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </span>
        <div>
          <p class="stat-value">{{ statsLoading ? "–" : stats.total }}</p>
          <p class="stat-label">Total tickets</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon bg-badge-open-bg text-badge-open-text">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <div>
          <p class="stat-value">{{ statsLoading ? "–" : stats.open }}</p>
          <p class="stat-label">Open</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon bg-badge-progress-bg text-badge-progress-text">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <div>
          <p class="stat-value">{{ statsLoading ? "–" : stats.inProgress }}</p>
          <p class="stat-label">In progress</p>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon bg-badge-resolved-bg text-badge-resolved-text">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
        <div>
          <p class="stat-value">{{ statsLoading ? "–" : stats.resolved }}</p>
          <p class="stat-label">Resolved</p>
        </div>
      </div>
    </div>

    <!-- Search + filters -->
    <div class="card p-4 mb-4">
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="relative flex-1">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="search"
            type="search"
            placeholder="Search by title or category…"
            class="input pl-9"
          />
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-2 text-sm text-text-muted">
            Status
            <select v-model="filters.status" @change="onFilterChange" class="select">
              <option value="">All</option>
              <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
          <label class="flex items-center gap-2 text-sm text-text-muted">
            Priority
            <select v-model="filters.priority" @change="load" class="select">
              <option value="">All</option>
              <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
            </select>
          </label>
          <button
            v-if="hasActiveFilters"
            @click="clearFilters"
            class="text-sm text-brand-600 hover:text-brand-500 font-medium"
          >
            Clear filters
          </button>
        </div>
      </div>
      <p v-if="activeViewLabel" class="text-xs text-text-muted mt-3">
        Showing: <span class="font-semibold text-text">{{ activeViewLabel }}</span>
      </p>
    </div>

    <!-- Table -->
    <div class="card overflow-hidden">
      <div v-if="error" class="p-6"><p class="alert-error">{{ error }}</p></div>

      <div v-else-if="loading" class="p-6 space-y-3">
        <div v-for="i in 5" :key="i" class="skeleton-row h-12"></div>
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
      </div>

      <div v-else class="overflow-x-auto">
        <table class="tbl min-w-[760px]">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Category</th>
              <th>Assignee</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="t in displayedTickets"
              :key="t.ticketId"
              class="clickable"
              @click="$router.push(`/tickets/${t.ticketId}`)"
            >
              <td class="font-mono text-xs text-text-muted whitespace-nowrap">#{{ shortId(t.ticketId) }}</td>
              <td class="font-medium text-text max-w-64">
                <span class="block truncate" :title="t.title">{{ t.title }}</span>
              </td>
              <td><Badge type="status" :value="t.status" /></td>
              <td><Badge type="priority" :value="t.priority" /></td>
              <td class="text-text-muted whitespace-nowrap">{{ t.category }}</td>
              <td class="whitespace-nowrap">
                <span v-if="t.assignee" class="inline-flex items-center gap-1.5 text-sm text-text">
                  <span class="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-[11px] font-bold flex items-center justify-center">
                    {{ t.assignee.charAt(0).toUpperCase() }}
                  </span>
                  <span class="truncate max-w-40" :title="t.assignee">{{ t.assignee }}</span>
                </span>
                <span v-else class="text-xs text-text-faint italic">Unassigned</span>
              </td>
              <td class="text-text-muted text-xs whitespace-nowrap">{{ formatDate(t.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <p v-if="!loading && !error" class="text-xs text-text-muted mt-3">
      {{ displayedTickets.length }} of {{ tickets.length }} ticket(s)
    </p>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Badge from "../components/Badge.vue";
import { api } from "../lib/api.js";
import { getRole, getUserEmail } from "../lib/auth.js";

const emit = defineEmits(["categories"]);

const route = useRoute();
const router = useRouter();
const role = getRole();
const userEmail = getUserEmail();

const statuses = ["open", "in-progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];

const filters = reactive({ status: "", priority: "" });
const search = ref("");
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

const activeViewLabel = computed(() => {
  const parts = [];
  if (view.value === "mine") parts.push(role === "agent" ? "assigned to me" : "my tickets");
  if (view.value === "unassigned") parts.push("unassigned");
  if (view.value === "all") parts.push("all tickets");
  if (filters.status) parts.push(`status: ${filters.status}`);
  if (filters.priority) parts.push(`priority: ${filters.priority}`);
  if (categoryFilter.value) parts.push(`category: ${categoryFilter.value}`);
  if (search.value.trim()) parts.push(`search: “${search.value.trim()}”`);
  return parts.join(" · ");
});

const hasActiveFilters = computed(
  () =>
    !!filters.status ||
    !!filters.priority ||
    !!view.value ||
    !!categoryFilter.value ||
    !!search.value.trim()
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
  router.replace({ path: "/", query });
}

function clearFilters() {
  search.value = "";
  filters.priority = "";
  filters.status = "";
  router.replace({ path: "/" });
}

watch(
  () => route.query,
  () => {
    syncFiltersFromQuery();
    load();
  }
);

onMounted(() => {
  syncFiltersFromQuery();
  load();
  loadStats();
});
</script>
