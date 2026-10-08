<template>
  <main class="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
    <router-link
      to="/"
      class="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-500 mb-5"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to tickets
    </router-link>

    <div v-if="error" class="alert-error">{{ error }}</div>

    <div v-else-if="loading" class="space-y-4" aria-label="Loading ticket">
      <div class="skeleton-row h-8 w-2/3"></div>
      <div class="card-pad space-y-3">
        <div class="skeleton-row h-4 w-full"></div>
        <div class="skeleton-row h-4 w-5/6"></div>
        <div class="skeleton-row h-4 w-4/6"></div>
      </div>
    </div>

    <div v-else-if="ticket">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <Badge type="status" :value="ticket.status" dot />
            <Badge type="priority" :value="ticket.priority" dot />
            <span class="badge bg-surface-3 text-text-muted border-border-strong/60">
              {{ ticket.category }}
            </span>
          </div>
          <h1 class="text-xl sm:text-2xl font-bold text-text tracking-tight break-words">{{ ticket.title }}</h1>
          <p class="text-xs font-mono text-text-faint mt-1.5">#{{ ticket.ticketId }}</p>
        </div>
      </div>

      <div class="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <!-- Main column -->
        <div class="space-y-5 min-w-0">
          <!-- Description -->
          <section class="card-pad" aria-label="Ticket description">
            <h2 class="section-title mb-4">Description</h2>
            <p class="text-sm text-text whitespace-pre-wrap leading-relaxed">{{ ticket.description }}</p>

            <div v-if="ticket.attachments && ticket.attachments.length" class="mt-6 pt-6 border-t border-border">
              <h3 class="section-title mb-3">
                Attachments <span class="text-text-faint font-normal normal-case">({{ ticket.attachments.length }})</span>
              </h3>
              <ul class="grid sm:grid-cols-2 gap-2">
                <li v-for="a in ticket.attachments" :key="a.key">
                  <a :href="a.downloadUrl" target="_blank" rel="noopener" class="file-card hover:border-brand-300 transition-colors">
                    <svg class="w-8 h-8 text-brand-500 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span class="min-w-0">
                      <span class="block font-medium text-text truncate" :title="a.fileName">{{ a.fileName }}</span>
                      <span class="text-xs text-text-muted">{{ formatSize(a.size) }}</span>
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </section>

          <!-- Activity timeline -->
          <section class="card-pad" aria-label="Ticket activity">
            <h2 class="section-title mb-5">Activity</h2>
            <ol v-if="activity.length" class="space-y-5">
              <li v-for="(a, i) in activity" :key="i" class="flex gap-3 text-sm">
                <div class="flex flex-col items-center">
                  <span class="timeline-dot"></span>
                  <span v-if="i < activity.length - 1" class="timeline-line"></span>
                </div>
                <div class="min-w-0 pb-1">
                  <p class="font-semibold text-text">{{ actionLabel(a.action) }}</p>
                  <p v-if="a.detail" class="text-text-muted mt-0.5 break-words text-[13px]">{{ a.detail }}</p>
                  <p class="text-text-faint text-xs mt-1 break-all">{{ a.byEmail }} · {{ formatDate(a.at) }}</p>
                </div>
              </li>
            </ol>
            <p v-else class="text-text-muted text-sm">No activity yet.</p>
          </section>

          <!-- Comments -->
          <section class="card-pad" aria-label="Ticket comments">
            <h2 class="section-title mb-5">
              Comments <span class="text-text-faint font-normal">({{ comments.length }})</span>
            </h2>
            <div v-if="comments.length" class="space-y-3 mb-6 max-h-96 overflow-y-auto pr-1">
              <article
                v-for="c in comments"
                :key="c.commentId"
                class="comment"
                :class="{ 'comment-agent': c.authorRole === 'agent' }"
              >
                <div class="flex items-center gap-2.5 mb-2">
                  <Avatar :name="c.authorEmail" size="sm" />
                  <span class="text-sm font-semibold text-text truncate" :title="c.authorEmail">{{ c.authorEmail }}</span>
                  <span
                    class="badge"
                    :class="c.authorRole === 'agent' ? 'badge-role-agent' : 'badge-role-customer'"
                    style="font-size: 10px"
                  >
                    {{ c.authorRole }}
                  </span>
                  <span class="text-xs text-text-faint ml-auto shrink-0">{{ formatDate(c.createdAt) }}</span>
                </div>
                <p class="text-sm text-text whitespace-pre-wrap break-words leading-relaxed">{{ c.text }}</p>
              </article>
            </div>
            <p v-else class="text-text-muted text-sm mb-4">No comments yet. Start the conversation below.</p>
            <p v-if="commentError" class="alert-error mb-3">{{ commentError }}</p>
            <label class="sr-only" for="new-comment">Write a comment</label>
            <textarea
              id="new-comment"
              v-model="newComment"
              rows="3"
              placeholder="Write a comment…"
              class="textarea mb-3"
            ></textarea>
            <button
              @click="addComment"
              :disabled="commenting || !newComment.trim()"
              class="btn btn-primary w-full sm:w-auto"
            >
              {{ commenting ? "Adding…" : "Add comment" }}
            </button>
          </section>
        </div>

        <!-- Sidebar column -->
        <div class="space-y-5 min-w-0">
          <!-- Details -->
          <section class="card-pad" aria-label="Ticket details">
            <h2 class="section-title mb-5">Details</h2>
            <dl class="space-y-4">
              <div>
                <dt class="meta-dt">Status</dt>
                <dd><Badge type="status" :value="ticket.status" dot /></dd>
              </div>
              <div>
                <dt class="meta-dt">Priority</dt>
                <dd><Badge type="priority" :value="ticket.priority" dot /></dd>
              </div>
              <div>
                <dt class="meta-dt">Requester</dt>
                <dd class="meta-dd">
                  <span class="inline-flex items-center gap-2 min-w-0">
                    <Avatar :name="ticket.customerEmail" size="xs" />
                    <span class="break-all">{{ ticket.customerEmail }}</span>
                  </span>
                </dd>
              </div>
              <div>
                <dt class="meta-dt">Assignee</dt>
                <dd class="meta-dd">
                  <span v-if="ticket.assignee" class="inline-flex items-center gap-2 min-w-0">
                    <Avatar :name="ticket.assignee" size="xs" />
                    <span class="break-all">{{ ticket.assignee }}</span>
                  </span>
                  <span v-else class="text-text-faint italic font-normal">Unassigned</span>
                </dd>
              </div>
              <div class="pt-4 border-t border-border grid grid-cols-2 gap-4">
                <div>
                  <dt class="meta-dt">Created</dt>
                  <dd class="meta-dd text-[13px]">{{ formatDate(ticket.createdAt) }}</dd>
                </div>
                <div>
                  <dt class="meta-dt">Updated</dt>
                  <dd class="meta-dd text-[13px]">{{ formatDate(ticket.updatedAt) }}</dd>
                </div>
              </div>
            </dl>
          </section>

          <!-- Agent management (agents only) -->
          <section v-if="isAgent" class="card-pad" aria-label="Manage ticket">
            <h2 class="section-title mb-4">Manage ticket</h2>
            <p v-if="saveError" class="alert-error mb-3">{{ saveError }}</p>
            <p v-if="saveOk" class="alert-success mb-3">Ticket updated.</p>
            <div class="space-y-4">
              <div>
                <label class="field-label" for="mgmt-status">Status</label>
                <select id="mgmt-status" v-model="manage.status" class="select w-full">
                  <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>
              <div>
                <label class="field-label" for="mgmt-assignee">Assignee</label>
                <input
                  id="mgmt-assignee"
                  v-model="manage.assignee"
                  placeholder="e.g. agent@example.com"
                  class="input"
                />
              </div>
              <button @click="saveManagement" :disabled="saving" class="btn btn-primary w-full">
                <span v-if="saving" class="spinner !w-4 !h-4 !border-white/40 !border-t-white"></span>
                {{ saving ? "Saving…" : "Save changes" }}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import Badge from "../components/Badge.vue";
import Avatar from "../components/Avatar.vue";
import { api } from "../lib/api.js";
import { getRole } from "../lib/auth.js";

const props = defineProps({ id: String });
const statuses = ["open", "in-progress", "resolved", "closed"];
const isAgent = getRole() === "agent";

const ticket = ref(null);
const comments = ref([]);
const loading = ref(true);
const error = ref("");
const manage = reactive({ status: "open", assignee: "" });
const saving = ref(false);
const saveError = ref("");
const saveOk = ref(false);
const newComment = ref("");
const commenting = ref(false);
const commentError = ref("");

const activity = computed(() =>
  [...(ticket.value?.activity || [])].sort((a, b) => b.at.localeCompare(a.at))
);

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatSize(bytes) {
  const kb = Math.round((bytes || 0) / 1024);
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function actionLabel(action) {
  return {
    created: "Ticket created",
    status_changed: "Status changed",
    assignee_changed: "Assignee changed",
    updated: "Ticket updated",
    comment_added: "Comment added",
  }[action] || action;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api.getTicket(props.id);
    ticket.value = data.ticket;
    manage.status = data.ticket.status;
    manage.assignee = data.ticket.assignee || "";
    const c = await api.listComments(props.id);
    comments.value = c.comments || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function saveManagement() {
  saveError.value = "";
  saveOk.value = false;
  saving.value = true;
  try {
    const { ticket: updated } = await api.updateTicket(props.id, {
      status: manage.status,
      assignee: manage.assignee.trim() || null,
    });
    ticket.value = updated;
    saveOk.value = true;
  } catch (e) {
    saveError.value = e.message;
  } finally {
    saving.value = false;
  }
}

async function addComment() {
  commentError.value = "";
  commenting.value = true;
  try {
    const { comment } = await api.addComment(props.id, newComment.value.trim());
    comments.value.push(comment);
    newComment.value = "";
    const data = await api.getTicket(props.id); // refresh activity timeline
    ticket.value = data.ticket;
  } catch (e) {
    commentError.value = e.message;
  } finally {
    commenting.value = false;
  }
}

onMounted(load);
</script>
