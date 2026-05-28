"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Check, Search, Sparkles, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FriendSearchResult, FriendsPageData } from "@/lib/fasting";
import { cn } from "@/lib/utils";

type FriendsViewProps = {
  initialData: FriendsPageData;
  providers: {
    google: boolean;
    github: boolean;
  };
  signedIn: boolean;
};

const searchSchema = z
  .string()
  .trim()
  .min(2, "Use at least 2 characters to search by name or email.");

function getInitials(value?: string | null) {
  if (!value) {
    return "FT";
  }

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function readApiError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };

    return payload.message || "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

export function FriendsView({ initialData, providers, signedIn }: FriendsViewProps) {
  const [friendsData, setFriendsData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);

  useEffect(() => {
    setFriendsData(initialData);
  }, [initialData]);

  async function refreshFriends() {
    const response = await fetch("/api/friends", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const nextData = (await response.json()) as FriendsPageData;
    setFriendsData(nextData);
    return nextData;
  }

  async function runSearch() {
    const parsedQuery = searchSchema.safeParse(query);

    if (!query.trim()) {
      setSearchResults([]);
      setSearchFeedback(null);
      return;
    }

    if (!parsedQuery.success) {
      setSearchFeedback(parsedQuery.error.issues[0]?.message ?? "Enter a valid search.");
      return;
    }

    setSearchFeedback(null);
    setIsSearching(true);

    try {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const payload = (await response.json()) as { results: FriendSearchResult[] };
      setSearchResults(payload.results);
      setSearchFeedback(payload.results.length ? "Results ready." : "No matching FastTrack members found yet.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to search profiles.");
    } finally {
      setIsSearching(false);
    }
  }

  async function addFriend(email: string) {
    setPendingActionId(email);

    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await refreshFriends();
      setSearchResults((current) => current.filter((result) => result.email !== email));
      toast.success("Friend request sent.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send request.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleRequest(friendshipId: string, action: "accepted" | "rejected" | "cancel") {
    setPendingActionId(friendshipId);

    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      await refreshFriends();
      toast.success(
        action === "accepted"
          ? "Friend request accepted."
          : action === "cancel"
            ? "Outgoing request cancelled."
            : "Friend request declined."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update request.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className="grid gap-6">
      {!signedIn ? (
        <EmptyState
          eyebrow="Friends"
          title="Build your fasting circle."
          description="Add trusted friends so you can see progress, stay accountable, and keep your habit social without turning it noisy."
          actions={
            <>
              <SignInDialog
                buttonClassName="w-full sm:w-auto"
                buttonLabel="Sign in to save your progress"
                providers={providers}
                size="lg"
              />
              <Link href="/feed" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                Preview the feed
              </Link>
            </>
          }
          preview={
            <div className="space-y-3">
              {[
                "Search by name or email to invite people you know.",
                "Incoming requests, outgoing requests, and your circle stay in one place.",
              ].map((item) => (
                <div key={item} className="glass-soft rounded-[1.4rem] px-4 py-4 text-sm text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          }
        />
      ) : null}

      <Card className="section-enter" style={{ animationDelay: "0ms" }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary shadow-[0_8px_20px_rgba(139,92,246,0.16)]">
              <Search className="size-4" />
            </div>
            <div>
              <CardTitle>Find Friends</CardTitle>
              <CardDescription>Search FastTrack profiles by name or email and invite the people you trust.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
              aria-label="Search for friends"
              placeholder="Search by name or email"
              value={query}
            />
            <Button
              aria-label="Search FastTrack profiles"
              className="h-11 w-full sm:w-auto px-4"
              disabled={isSearching || !signedIn}
              onClick={() => void runSearch()}
            >
              <Search className="size-4" />
            </Button>
          </div>
          {searchFeedback ? <p className="text-sm text-muted-foreground">{searchFeedback}</p> : null}

          <div className="space-y-3">
            {searchResults.length ? (
              searchResults.map((result) => (
                <div key={result.id} className="glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarImage src={result.avatarUrl ?? undefined} alt={result.displayName ?? "Member"} />
                      <AvatarFallback>{getInitials(result.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{result.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.email ?? "FastTrack member"} • {result.currentStreak} day streak
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full rounded-xl sm:w-auto"
                    disabled={pendingActionId === result.email}
                    onClick={() => result.email && void addFriend(result.email)}
                    size="sm"
                  >
                    <UserPlus className="mr-2 size-4" />
                    Add
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-10 text-center text-sm text-muted-foreground">
                Search results will appear here once you look up a name or email.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(friendsData.incomingRequests.length || friendsData.outgoingRequests.length) && (
        <Card className="section-enter" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gold/10 p-2 text-gold shadow-[0_8px_20px_rgba(245,158,11,0.16)]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <CardTitle>Pending requests</CardTitle>
                <CardDescription>Incoming and outgoing requests, all in one place.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {friendsData.incomingRequests.length ? (
              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Incoming</h2>
                {friendsData.incomingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={request.sender.avatarUrl ?? undefined} alt={request.sender.displayName ?? "Friend"} />
                        <AvatarFallback>{getInitials(request.sender.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.sender.displayName ?? request.sender.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.sender.email ?? "FastTrack member"} • {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="rounded-xl"
                        disabled={pendingActionId === request.id}
                        onClick={() => void handleRequest(request.id, "accepted")}
                        size="sm"
                        variant="secondary"
                      >
                        <Check className="mr-1 size-4" />
                        Accept
                      </Button>
                      <Button
                        className="rounded-xl"
                        disabled={pendingActionId === request.id}
                        onClick={() => void handleRequest(request.id, "rejected")}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="mr-1 size-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            {friendsData.outgoingRequests.length ? (
              <section className="space-y-3">
                <h2 className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Outgoing</h2>
                {friendsData.outgoingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="glass-soft flex flex-col gap-3 rounded-[1.5rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarImage src={request.receiver.avatarUrl ?? undefined} alt={request.receiver.displayName ?? "Friend"} />
                        <AvatarFallback>{getInitials(request.receiver.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.receiver.displayName ?? request.receiver.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {request.receiver.email ?? "FastTrack member"} • sent {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="rounded-xl"
                      disabled={pendingActionId === request.id}
                      onClick={() => void handleRequest(request.id, "cancel")}
                      size="sm"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </section>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="section-enter" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-accent/10 p-2 text-accent shadow-[0_8px_20px_rgba(34,197,94,0.16)]">
              <Users className="size-4" />
            </div>
            <div>
              <CardTitle>Friends list</CardTitle>
              <CardDescription>Your accepted FastTrack circle, ordered by current streak.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {friendsData.friends.length ? (
            friendsData.friends.map((friend) => (
              <div
                key={friend.id}
                className="glass-soft flex items-center justify-between gap-3 rounded-[1.5rem] px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="sm">
                    <AvatarImage src={friend.avatarUrl ?? undefined} alt={friend.displayName ?? "Friend"} />
                    <AvatarFallback>{getInitials(friend.displayName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-foreground">{friend.displayName}</p>
                    <p className="text-xs text-muted-foreground">{friend.longestStreak} day longest streak</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-[family:var(--font-heading)] text-lg font-semibold text-foreground">
                    {friend.currentStreak}
                  </p>
                  <p className="text-xs text-muted-foreground">current streak</p>
                </div>
              </div>
            ))
          ) : friendsData.incomingRequests.length || friendsData.outgoingRequests.length ? (
            <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/60 px-5 py-12 text-center text-sm text-muted-foreground">
              Your accepted friends will appear here once requests are confirmed.
            </div>
          ) : (
            <EmptyState
              eyebrow="Getting started"
              title="Build your fasting circle."
              description="Search for a friend by name or email, send an invite, and keep your habit grounded in steady accountability."
              actions={
                <Link href="/feed" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto")}>
                  Preview the feed
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
