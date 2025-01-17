import Link from "next/link";
import { useRouter } from "next/router";

import { useState } from "react";

import { useTeam } from "@/context/team-context";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { mutate } from "swr";

import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";
import AppLayout from "@/components/layouts/app";
import Navbar from "@/components/settings/navbar";
import Folder from "@/components/shared/icons/folder";
import MoreVertical from "@/components/shared/icons/more-vertical";
import { AddTeamMembers } from "@/components/teams/add-team-member-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

import { useAnalytics } from "@/lib/analytics";
import { usePlan } from "@/lib/swr/use-billing";
import { useInvitations } from "@/lib/swr/use-invitations";
import useLimits from "@/lib/swr/use-limits";
import { useGetTeam } from "@/lib/swr/use-team";
import { useTeams } from "@/lib/swr/use-teams";
import { CustomUser } from "@/lib/types";

export default function Billing() {
  const [isTeamMemberInviteModalOpen, setTeamMemberInviteModalOpen] =
    useState<boolean>(false);
  const [leavingUserId, setLeavingUserId] = useState<string>("");

  const { data: session } = useSession();
  const { team, loading } = useGetTeam()!;
  const teamInfo = useTeam();
  const { plan: userPlan } = usePlan();
  const { limits } = useLimits();
  const { teams } = useTeams();
  const analytics = useAnalytics();

  const { invitations } = useInvitations();

  const router = useRouter();

  const numUsers = (team && team.users.length) ?? 1;

  const getUserDocumentCount = (userId: string) => {
    const documents = team?.documents.filter(
      (document) => document.owner.id === userId,
    );
    return documents?.length;
  };

  const isCurrentUser = (userId: string) => {
    if ((session?.user as CustomUser)?.id === userId) {
      return true;
    }
    return false;
  };

  const isCurrentUserAdmin = () => {
    return team?.users.some(
      (user) =>
        user.role === "ADMIN" &&
        user.userId === (session?.user as CustomUser)?.id,
    );
  };

  const removeTeammate = async (teamId: string, userId: string) => {
    setLeavingUserId(userId);
    const response = await fetch(`/api/teams/${teamId}/remove-teammate`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userToBeDeleted: userId,
      }),
    });

    if (response.status !== 204) {
      const error = await response.json();
      toast.error(error);
      setLeavingUserId("");
      return;
    }

    await mutate(`/api/teams/${teamInfo?.currentTeam?.id}`);
    await mutate("/api/teams");

    setLeavingUserId("");
    if (isCurrentUser(userId)) {
      toast.success(`Successfully leaved team ${teamInfo?.currentTeam?.name}`);
      teamInfo?.setCurrentTeam({ id: teams![0].id });
      router.push("/documents");
      return;
    }

    analytics.capture("Team Member Removed", {
      userId: userId,
      teamId: teamInfo?.currentTeam?.id,
    });

    toast.success("Teammate removed successfully!");
  };

  // resend invitation function
  const resendInvitation = async (invitation: { email: string } & any) => {
    const response = await fetch(
      `/api/teams/${teamInfo?.currentTeam?.id}/invitations/resend`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: invitation.email as string,
        }),
      },
    );

    if (response.status !== 200) {
      const error = await response.json();
      toast.error(error);
      return;
    }

    analytics.capture("Team Member Invitation Resent", {
      email: invitation.email as string,
      teamId: teamInfo?.currentTeam?.id,
    });

    toast.success("Invitation resent successfully!");
  };

  // revoke invitation function
  const revokeInvitation = async (invitation: { email: string } & any) => {
    const response = await fetch(
      `/api/teams/${teamInfo?.currentTeam?.id}/invitations`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: invitation.email as string,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      toast.error(error);
      return;
    }

    analytics.capture("Team Member Invitation Revoked", {
      email: invitation.email as string,
      teamId: teamInfo?.currentTeam?.id,
    });

    mutate(`/api/teams/${teamInfo?.currentTeam?.id}/invitations`);

    toast.success("Invitation revoked successfully!");
  };

  return (
    <AppLayout>
      <Navbar current="People" />
      <div className="p-4 sm:m-4 sm:p-4">
        <div className="mb-4 flex items-center justify-between md:mb-8 lg:mb-12">
          <div className="space-y-1">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">
              Team Members
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage your team members
            </p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary p-10">
            <div className="flex flex-col space-y-3">
              <h2 className="text-xl font-medium">People</h2>
              <p className="text-sm text-secondary-foreground">
                Teammates that have access to this project.
              </p>
            </div>
            {userPlan !== "free" &&
            (limits === null || (limits && limits.users >= numUsers)) ? (
              <AddTeamMembers
                open={isTeamMemberInviteModalOpen}
                setOpen={setTeamMemberInviteModalOpen}
              >
                <Button>Invite</Button>
              </AddTeamMembers>
            ) : (
              <UpgradePlanModal
                clickedPlan={"Pro"}
                trigger={"invite_team_members"}
              >
                <Button>Upgrade to invite members</Button>
              </UpgradePlanModal>
            )}
          </div>
        </div>

        <ul className="mt-6 divide-y rounded-lg border">
          {loading && (
            <div className="flex items-center justify-between px-10 py-4">
              <div className="flex items-center gap-12">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-12">
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-6 w-4" />
              </div>
            </div>
          )}
          {team?.users.map((member, index) => (
            <li
              className="flex items-center justify-between px-10 py-4"
              key={index}
            >
              <div className="flex items-center gap-12">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">{member.user.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <Folder />
                    <span className="text-xs text-foreground">
                      {getUserDocumentCount(member.userId)}{" "}
                      {getUserDocumentCount(member.userId) === 1
                        ? "document"
                        : "documents"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-12">
                <span className="text-sm capitalize text-foreground">
                  {member.role.toLowerCase()}
                </span>
                {leavingUserId === member.userId ? (
                  <span className="text-xs">leaving...</span>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {isCurrentUser(member.userId) && (
                        <DropdownMenuItem
                          onClick={() =>
                            removeTeammate(member.teamId, member.userId)
                          }
                          className="text-red-500 hover:cursor-pointer focus:bg-destructive focus:text-destructive-foreground"
                        >
                          Leave team
                        </DropdownMenuItem>
                      )}
                      {isCurrentUserAdmin() && !isCurrentUser(member.userId) ? (
                        <DropdownMenuItem
                          onClick={() =>
                            removeTeammate(member.teamId, member.userId)
                          }
                          className="text-red-500 hover:cursor-pointer focus:bg-destructive focus:text-destructive-foreground"
                        >
                          Remove teammate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled
                          className="text-red-500 focus:bg-destructive focus:text-destructive-foreground"
                        >
                          Remove teammate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          ))}
          {invitations &&
            invitations.map((invitation, index) => (
              <li
                className="flex items-center justify-between px-10 py-4"
                key={index}
              >
                <div className="flex items-center gap-12">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">
                      {invitation.email}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {invitation.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-12">
                  <span
                    className="text-sm text-foreground"
                    title={`Expires on ${new Date(
                      invitation.expires,
                    ).toLocaleString()}`}
                  >
                    {new Date(invitation.expires) >= new Date(Date.now())
                      ? "Pending"
                      : "Expired"}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => resendInvitation(invitation)}
                        className="text-red-500 hover:cursor-pointer focus:bg-destructive focus:text-destructive-foreground"
                      >
                        Resend
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => revokeInvitation(invitation)}
                        className="text-red-500 hover:cursor-pointer focus:bg-destructive focus:text-destructive-foreground"
                      >
                        Revoke invitation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
        </ul>
      </div>
    </AppLayout>
  );
}
