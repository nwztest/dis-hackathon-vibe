import { UserCheck, UserMinus, UsersRound } from "lucide-react";
import { updateUserRoleAction } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { getUserProfiles } from "@/lib/data";
import { requireAdminProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const profile = await requireAdminProfile("/users");
  const users = await getUserProfiles();

  return (
    <AppShell profile={profile ?? undefined}>
      <main className="page-content">
        <div className="page-heading">
          <div>
            <h1>Users</h1>
            <p>Approve confirmed accounts before they can access home monitoring data.</p>
          </div>
        </div>
        <section className="table-panel">
          <div className="table-header user-table">
            <span>User</span>
            <span>Contact</span>
            <span>Role</span>
            <span>Created</span>
            <span>Actions</span>
          </div>
          {users.map((user) => {
            const isSelf = user.id === profile?.id;
            const isManagedRole = user.role === "unapproved" || user.role === "caregiver";

            return (
              <article className="table-row user-table" key={user.id}>
                <div>
                  <UsersRound size={18} />
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
                <span>{user.phone || "No phone"}</span>
                <span className={`status-pill ${user.role}`}>{user.role}</span>
                <span>{user.createdAt}</span>
                <div className="button-row">
                  {isSelf ? <span className="muted-note">Current admin</span> : null}
                  {!isSelf && user.role === "admin" ? <span className="muted-note">Manual admin role</span> : null}
                  {!isSelf && !isManagedRole && user.role !== "admin" ? <span className="muted-note">Role managed later</span> : null}
                  {!isSelf && isManagedRole && user.role !== "caregiver" ? (
                    <form action={updateUserRoleAction.bind(null, user.id, "caregiver")}>
                      <button type="submit">
                        <UserCheck size={14} />
                        Approve
                      </button>
                    </form>
                  ) : null}
                  {!isSelf && isManagedRole && user.role !== "unapproved" ? (
                    <form action={updateUserRoleAction.bind(null, user.id, "unapproved")}>
                      <button type="submit">
                        <UserMinus size={14} />
                        Mark unapproved
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
