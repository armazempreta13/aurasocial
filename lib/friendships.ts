'use client';

import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { createNotification } from './notifications';
import { increment as firestoreIncrement } from 'firebase/firestore';

export type FriendshipCategory = 'close_friends' | 'friends' | 'colleagues' | 'interest_contacts';

export type RelationshipStatus =
  | 'none'
  | 'request_sent'
  | 'request_received'
  | 'friends'
  | 'muted'
  | 'restricted'
  | 'blocked';

export interface RelationshipSettings {
  whoCanSendFriendRequest: 'everyone' | 'friends_of_friends' | 'same_communities' | 'nobody';
  whoCanSeeFriendList: 'everyone' | 'friends' | 'only_me';
  whoCanMessageMe: 'everyone' | 'friends' | 'friends_and_interest_contacts' | 'nobody';
  whoCanInviteMeToCommunities: 'everyone' | 'friends' | 'close_friends' | 'nobody';
  whoCanSeeFriendsOnlyPosts: 'friends' | 'close_friends';
  allowFriendRequestMessage: boolean;
  showMutualFriends: boolean;
}

export interface RelationshipSnapshot {
  status: RelationshipStatus;
  friendship: any | null;
  friendRequest: any | null;
  incomingRequest: any | null;
  block: any | null;
  blockedBy: any | null;
  restriction: any | null;
  settings: RelationshipSettings;
  affinityScore: number;
  mutualCommunitiesCount: number;
}

const DAILY_REQUEST_LIMIT = 20;
const DEFAULT_RELATIONSHIP_SETTINGS: RelationshipSettings = {
  whoCanSendFriendRequest: 'everyone',
  whoCanSeeFriendList: 'friends',
  whoCanMessageMe: 'friends',
  whoCanInviteMeToCommunities: 'friends',
  whoCanSeeFriendsOnlyPosts: 'friends',
  allowFriendRequestMessage: true,
  showMutualFriends: true,
};

export function getPairId(userA: string, userB: string) {
  return [userA, userB].sort().join('__');
}

export function getDirectionalId(fromUid: string, toUid: string) {
  return `${fromUid}__${toUid}`;
}

export function getDefaultRelationshipSettings(): RelationshipSettings {
  return DEFAULT_RELATIONSHIP_SETTINGS;
}

function isPermissionDenied(error: any) {
  return (
    error?.code === 'permission-denied' ||
    String(error?.message || '').includes('Missing or insufficient permissions')
  );
}

async function setFriendshipDocument(
  friendshipRef: ReturnType<typeof doc>,
  fullPayload: Record<string, any>,
  fallbackPayload?: Record<string, any>
) {
  try {
    await setDoc(friendshipRef, fullPayload, { merge: true });
  } catch (error) {
    if (!fallbackPayload || !isPermissionDenied(error)) {
      throw error;
    }

    await setDoc(friendshipRef, fallbackPayload, { merge: true });
  }
}

export async function ensureRelationshipSettings(uid: string) {
  const settingsRef = doc(db, 'relationship_settings', uid);
  const settingsSnap = await getDoc(settingsRef);

  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      ...DEFAULT_RELATIONSHIP_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    return DEFAULT_RELATIONSHIP_SETTINGS;
  }

  return {
    ...DEFAULT_RELATIONSHIP_SETTINGS,
    ...(settingsSnap.data() as Partial<RelationshipSettings>),
  };
}

// Read-only version — does NOT create the document (safe to call as another user)
async function readRelationshipSettings(uid: string): Promise<RelationshipSettings> {
  try {
    const settingsSnap = await getDoc(doc(db, 'relationship_settings', uid));
    if (!settingsSnap.exists()) return { ...DEFAULT_RELATIONSHIP_SETTINGS };
    return {
      ...DEFAULT_RELATIONSHIP_SETTINGS,
      ...(settingsSnap.data() as Partial<RelationshipSettings>),
    };
  } catch (err) {
    console.warn(`Could not read relationship settings for ${uid}:`, err);
    return { ...DEFAULT_RELATIONSHIP_SETTINGS };
  }
}

async function getMutualCommunitiesCount(viewerUid: string, targetUid: string) {
  try {
    const communitiesSnapshot = await getDocs(query(collection(db, 'communities'), where('members', 'array-contains', viewerUid), limit(50)));
    return communitiesSnapshot.docs.reduce((count, communityDoc) => {
      const members = (communityDoc.data().members || []) as string[];
      return count + (members.includes(targetUid) ? 1 : 0);
    }, 0);
  } catch (err) {
    console.warn(`Could not load mutual communities for ${viewerUid}/${targetUid}:`, err);
    return 0;
  }
}

export async function getAffinityScore(viewerUid: string, targetUid: string) {
  const affinitySnap = await getDoc(doc(db, 'affinity_scores', getDirectionalId(viewerUid, targetUid)));
  return affinitySnap.exists() ? affinitySnap.data().score || 0 : 0;
}

export async function getRelationshipSnapshot(viewerUid: string, targetUid: string): Promise<RelationshipSnapshot> {
  const safeGet = async (ref: any) => {
    try {
      return await getDoc(ref);
    } catch (err) {
      console.warn(`Safe get failed for ${ref.path}:`, err);
      return { exists: () => false, data: () => null } as any;
    }
  };

  const [
    friendshipSnap,
    outgoingRequestSnap,
    incomingRequestSnap,
    blockSnap,
    blockedBySnap,
    restrictionSnap,
    settings,
    affinityScore,
    mutualCommunitiesCount,
  ] = await Promise.all([
    safeGet(doc(db, 'friendships', getPairId(viewerUid, targetUid))),
    safeGet(doc(db, 'friend_requests', getDirectionalId(viewerUid, targetUid))),
    safeGet(doc(db, 'friend_requests', getDirectionalId(targetUid, viewerUid))),
    safeGet(doc(db, 'blocks', getDirectionalId(viewerUid, targetUid))),
    safeGet(doc(db, 'blocks', getDirectionalId(targetUid, viewerUid))),
    safeGet(doc(db, 'restrictions', getDirectionalId(viewerUid, targetUid))),
    readRelationshipSettings(targetUid),
    getAffinityScore(viewerUid, targetUid).catch(() => 10),
    getMutualCommunitiesCount(viewerUid, targetUid).catch(() => 0),
  ]);

  const friendship = friendshipSnap.exists() ? friendshipSnap.data() : null;
  const friendRequest = outgoingRequestSnap.exists() ? outgoingRequestSnap.data() : null;
  const incomingRequest = incomingRequestSnap.exists() ? incomingRequestSnap.data() : null;
  const block = blockSnap.exists() ? blockSnap.data() : null;
  const blockedBy = blockedBySnap.exists() ? blockedBySnap.data() : null;
  const restriction = restrictionSnap.exists() ? restrictionSnap.data() : null;

  let status: RelationshipStatus = 'none';

  if (block || blockedBy) status = 'blocked';
  else if (restriction?.active) status = 'restricted';
  else if (friendship?.status === 'active') status = friendship.mutedBy?.includes(viewerUid) ? 'muted' : 'friends';
  else if (friendRequest?.status === 'pending') status = 'request_sent';
  else if (incomingRequest?.status === 'pending') status = 'request_received';

  return {
    status,
    friendship,
    friendRequest,
    incomingRequest,
    block,
    blockedBy,
    restriction,
    settings,
    affinityScore,
    mutualCommunitiesCount,
  };
}

async function countRecentOutgoingRequests(fromUid: string) {
  const dayAgo = Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const requestsQuery = query(collection(db, 'friend_requests'), where('fromUid', '==', fromUid));
  const requestsSnapshot = await getDocs(requestsQuery);
  return requestsSnapshot.docs.filter((requestDoc) => {
    const createdAt = requestDoc.data().createdAt;
    return createdAt?.seconds ? createdAt.seconds >= dayAgo.seconds : false;
  }).length;
}

function canSendRequestFromSettings(settings: RelationshipSettings, mutualCommunitiesCount: number) {
  switch (settings.whoCanSendFriendRequest) {
    case 'everyone':
      return true;
    case 'same_communities':
      return mutualCommunitiesCount > 0;
    case 'friends_of_friends':
      return mutualCommunitiesCount > 0;
    case 'nobody':
      return false;
    default:
      return false;
  }
}

export async function sendFriendRequest(params: {
  fromUser: any;
  toUser: any;
  message?: string;
  category?: FriendshipCategory;
  source?: 'profile' | 'network' | 'community' | 'suggestion';
}) {
  const { fromUser, toUser, message, category = 'friends', source = 'profile' } = params;
  // Support both {uid} and {id} shapes (Firestore docs return `id` not `uid`)
  const toUid: string = toUser?.uid || toUser?.id;
  const fromUid: string = fromUser?.uid || fromUser?.id;
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('Invalid friendship request.');
  }
  // Normalise to uid shape so the rest of the function works
  if (!fromUser.uid) fromUser.uid = fromUid;
  if (!toUser.uid) toUser.uid = toUid;

  const outgoingInLastDay = await countRecentOutgoingRequests(fromUser.uid);
  if (outgoingInLastDay >= DAILY_REQUEST_LIMIT) {
    throw new Error('Daily friend request limit reached. Try again tomorrow.');
  }

  const snapshot = await getRelationshipSnapshot(fromUser.uid, toUser.uid);
  if (snapshot.status === 'blocked') throw new Error('This relationship is blocked.');
  if (snapshot.status === 'friends' || snapshot.status === 'muted') throw new Error('You are already connected.');
  if (snapshot.status === 'request_sent') throw new Error('Friend request already sent.');
  if (!canSendRequestFromSettings(snapshot.settings, snapshot.mutualCommunitiesCount)) {
    throw new Error('This user is not accepting friend requests from you right now.');
  }

  const requestRef = doc(db, 'friend_requests', getDirectionalId(fromUser.uid, toUser.uid));
  await setDoc(requestRef, {
    fromUid: fromUser.uid,
    toUid: toUser.uid,
    status: 'pending',
    message: snapshot.settings.allowFriendRequestMessage ? (message?.trim() || null) : null,
    category,
    context: {
      mutualFriendsCount: 0,
      sharedCommunitiesCount: snapshot.mutualCommunitiesCount,
      source,
    },
    createdAt: serverTimestamp(),
    respondedAt: null,
  });

  await createNotification({
    userId: toUser.uid,
    actorId: fromUser.uid,
    actorName: fromUser.displayName || '',
    actorPhoto: fromUser.photoURL || '',
    type: 'friend_request',
  });
}

export async function respondToFriendRequest(params: {
  requestOwnerUid: string;
  actorUser: any;
  action: 'accept' | 'decline' | 'ignore';
}) {
  const { requestOwnerUid, actorUser, action } = params;
  const actorUid = actorUser?.uid || actorUser?.id;
  if (!actorUid) throw new Error('Invalid actor user.');

  const requestRef = doc(db, 'friend_requests', getDirectionalId(requestOwnerUid, actorUid));
  const requestSnap = await getDoc(requestRef);
  const pairId = getPairId(requestOwnerUid, actorUid);
  const friendshipRef = doc(db, 'friendships', pairId);

  if (!requestSnap.exists()) {
    if (action === 'accept') {
      const friendshipSnap = await getDoc(friendshipRef);
      if (friendshipSnap.exists() && friendshipSnap.data().status === 'active') {
        return;
      }
    }
    throw new Error('Friend request not found.');
  }

  const requestData = requestSnap.data();
  if (requestData.toUid !== actorUid) {
    throw new Error('Invalid friend request recipient.');
  }

  if (requestData.status !== 'pending') {
    // If it's already accepted, we can just return silently
    if (requestData.status === 'accepted') {
      const friendshipSnap = await getDoc(friendshipRef);
      if (friendshipSnap.exists() && friendshipSnap.data().status === 'active') {
        return;
      }
    }
    // If it's declined or ignored, and the user tries to decline/ignore again, return silently
    if (action !== 'accept' && (requestData.status === 'declined' || requestData.status === 'ignored')) {
      return;
    }
    throw new Error('Invalid friend request state.');
  }

  if (action === 'accept') {
    const now = serverTimestamp();
    const batch = writeBatch(db);

    // 1. Create/Update friendship
    batch.set(friendshipRef, {
      pairId,
      users: [requestOwnerUid, actorUid].sort(),
      status: 'active',
      categories: {
        [requestOwnerUid]: requestData.category || 'friends',
        [actorUid]: 'friends',
      },
      mutedBy: [],
      createdAt: now,
      updatedAt: now,
      removedAt: null,
    }, { merge: true });

    // 2. Update request status
    batch.update(requestRef, {
      status: 'accepted',
      respondedAt: now,
    });

    // 3. Increment counters for both users
    const ownerRef = doc(db, 'users', requestOwnerUid);
    const actorRef = doc(db, 'users', actorUid);
    
    batch.update(ownerRef, {
      friendsCount: firestoreIncrement(1),
      followersCount: firestoreIncrement(1),
      followingCount: firestoreIncrement(1),
    });
    
    batch.update(actorRef, {
      friendsCount: firestoreIncrement(1),
      followersCount: firestoreIncrement(1),
      followingCount: firestoreIncrement(1),
    });

    // 4. Create follower records for mutual follow
    const followA = doc(db, 'followers', `${requestOwnerUid}_${actorUid}`);
    const followB = doc(db, 'followers', `${actorUid}_${requestOwnerUid}`);
    
    batch.set(followA, {
      followerId: requestOwnerUid,
      followingId: actorUid,
      createdAt: now
    });
    
    batch.set(followB, {
      followerId: actorUid,
      followingId: requestOwnerUid,
      createdAt: now
    });

    await batch.commit();


    await createNotification({
      userId: requestOwnerUid,
      actorId: actorUid,
      actorName: actorUser.displayName || '',
      actorPhoto: actorUser.photoURL || '',
      type: 'friend_accept',
    });
    
    await recalculateAffinityScore(requestOwnerUid, actorUid, true);
    await recalculateAffinityScore(actorUid, requestOwnerUid, true);
    return;
  }


  await updateDoc(requestRef, {
    status: action === 'decline' ? 'declined' : 'ignored',
    respondedAt: serverTimestamp(),
  });
}

export async function cancelFriendRequest(fromUid: string, toUid: string) {
  const requestRef = doc(db, 'friend_requests', getDirectionalId(fromUid, toUid));
  const snap = await getDoc(requestRef);
  if (!snap.exists()) return; // already gone — nothing to cancel
  await updateDoc(requestRef, {
    status: 'cancelled',
    respondedAt: serverTimestamp(),
  });
}

export async function removeFriendship(viewerUid: string, targetUid: string) {
  const friendshipRef = doc(db, 'friendships', getPairId(viewerUid, targetUid));
  const friendshipSnap = await getDoc(friendshipRef);
  
  if (!friendshipSnap.exists() || friendshipSnap.data().status !== 'active') return;

  const now = serverTimestamp();
  const batch = writeBatch(db);

  // 1. Mark friendship as removed
  batch.update(friendshipRef, {
    status: 'removed',
    removedAt: now,
    updatedAt: now,
  });

  // 2. Decrement counters
    const viewerRef = doc(db, 'users', viewerUid);
    const targetRef = doc(db, 'users', targetUid);

    batch.update(viewerRef, {
      friendsCount: firestoreIncrement(-1),
      followersCount: firestoreIncrement(-1),
      followingCount: firestoreIncrement(-1),
    });

    batch.update(targetRef, {
      friendsCount: firestoreIncrement(-1),
      followersCount: firestoreIncrement(-1),
      followingCount: firestoreIncrement(-1),
    });

    // 3. Remove follower records
    const followA = doc(db, 'followers', `${viewerUid}_${targetUid}`);
    const followB = doc(db, 'followers', `${targetUid}_${viewerUid}`);
    batch.delete(followA);
    batch.delete(followB);

    await batch.commit();

}


export async function setRestricted(viewerUid: string, targetUid: string, active: boolean) {
  const restrictionRef = doc(db, 'restrictions', getDirectionalId(viewerUid, targetUid));
  if (!active) {
    await deleteDoc(restrictionRef);
    return;
  }

  await setDoc(restrictionRef, {
    fromUid: viewerUid,
    toUid: targetUid,
    active: true,
    hideActivity: true,
    suppressNotifications: true,
    dmToFilteredInbox: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

export async function toggleMutedFriendship(viewerUid: string, targetUid: string, muted: boolean) {
  const friendshipRef = doc(db, 'friendships', getPairId(viewerUid, targetUid));
  const friendshipSnap = await getDoc(friendshipRef);
  if (!friendshipSnap.exists()) throw new Error('Friendship not found.');

  const data = friendshipSnap.data();
  const mutedBy = new Set<string>(data.mutedBy || []);
  if (muted) mutedBy.add(viewerUid);
  else mutedBy.delete(viewerUid);

  await setFriendshipDocument(friendshipRef, {
    pairId: getPairId(viewerUid, targetUid),
    users: data.users || [viewerUid, targetUid].sort(),
    status: data.status || 'active',
    mutedBy: Array.from(mutedBy),
    updatedAt: serverTimestamp(),
  });
}

export async function blockUser(viewerUid: string, targetUid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'blocks', getDirectionalId(viewerUid, targetUid)), {
    fromUid: viewerUid,
    toUid: targetUid,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'restrictions', getDirectionalId(viewerUid, targetUid)), {
    fromUid: viewerUid,
    toUid: targetUid,
    active: true,
    hideActivity: true,
    suppressNotifications: true,
    dmToFilteredInbox: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, 'friend_requests', getDirectionalId(viewerUid, targetUid)), {
    fromUid: viewerUid,
    toUid: targetUid,
    status: 'blocked',
    message: null,
    createdAt: serverTimestamp(),
    respondedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(db, 'friend_requests', getDirectionalId(targetUid, viewerUid)), {
    fromUid: targetUid,
    toUid: viewerUid,
    status: 'blocked',
    message: null,
    createdAt: serverTimestamp(),
    respondedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(db, 'friendships', getPairId(viewerUid, targetUid)), {
    pairId: getPairId(viewerUid, targetUid),
    users: [viewerUid, targetUid].sort(),
    status: 'removed',
    removedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await batch.commit();
}

export async function unblockUser(viewerUid: string, targetUid: string) {
  await deleteDoc(doc(db, 'blocks', getDirectionalId(viewerUid, targetUid)));
}

export async function toggleFollowUser(params: {
  followerUid: string;
  followingUid: string;
  isFollowing: boolean;
  followerName?: string;
  followerPhoto?: string;
}) {
  const { followerUid, followingUid, isFollowing, followerName, followerPhoto } = params;
  const followRef = doc(db, 'followers', `${followerUid}_${followingUid}`);
  const targetUserRef = doc(db, 'users', followingUid);
  const currentUserRef = doc(db, 'users', followerUid);
  const batch = writeBatch(db);

  if (isFollowing) {
    // Unfollow
    batch.delete(followRef);
    batch.update(targetUserRef, { followersCount: firestoreIncrement(-1) });
    batch.update(currentUserRef, { followingCount: firestoreIncrement(-1) });
  } else {
    // Follow
    batch.set(followRef, {
      followerId: followerUid,
      followingId: followingUid,
      createdAt: serverTimestamp()
    });
    batch.update(targetUserRef, { followersCount: firestoreIncrement(1) });
    batch.update(currentUserRef, { followingCount: firestoreIncrement(1) });

    await createNotification({
      userId: followingUid,
      actorId: followerUid,
      actorName: followerName || 'Usuário',
      actorPhoto: followerPhoto || '',
      type: 'follow',
    });
  }

  await batch.commit();
}

export async function updateRelationshipSettings(uid: string, settings: RelationshipSettings) {
  await setDoc(
    doc(db, 'relationship_settings', uid),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getFriendIds(uid: string) {
  try {
    const friendshipsSnapshot = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', uid)));
    return friendshipsSnapshot.docs
      .map((friendshipDoc) => friendshipDoc.data())
      .filter((friendship) => friendship.status === 'active')
      .map((friendship) => friendship.users.find((userId: string) => userId !== uid))
      .filter(Boolean);
  } catch (err) {
    console.warn(`Could not load friends for ${uid} (likely permission/index issue):`, err);
    return [];
  }
}

export async function getBlockedUserIds(uid: string) {
  const [outgoingBlocks, incomingBlocks] = await Promise.all([
    getDocs(query(collection(db, 'blocks'), where('fromUid', '==', uid))),
    getDocs(query(collection(db, 'blocks'), where('toUid', '==', uid))),
  ]);

  return new Set<string>([
    ...outgoingBlocks.docs.map((blockDoc) => blockDoc.data().toUid),
    ...incomingBlocks.docs.map((blockDoc) => blockDoc.data().fromUid),
  ]);
}

export async function recalculateAffinityScore(viewerUid: string, targetUid: string, isNewFriendship = false) {
  const mutualCommunitiesCount = await getMutualCommunitiesCount(viewerUid, targetUid);
  const friendshipSnap = await getDoc(doc(db, 'friendships', getPairId(viewerUid, targetUid)));
  const friendshipLongevityBonus = friendshipSnap.exists() && friendshipSnap.data().status === 'active' ? 20 : 0;
  const score = Math.min(
    100,
    15 +
      mutualCommunitiesCount * 12 +
      friendshipLongevityBonus +
      (isNewFriendship ? 18 : 0)
  );

  await setDoc(doc(db, 'affinity_scores', getDirectionalId(viewerUid, targetUid)), {
    viewerUid,
    targetUid,
    score,
    breakdown: {
      interaction: isNewFriendship ? 18 : 10,
      reciprocity: friendshipLongevityBonus > 0 ? 18 : 0,
      longevity: friendshipLongevityBonus,
      sharedCommunities: mutualCommunitiesCount * 12,
      quality: 12,
      recency: 10,
    },
    updatedAt: serverTimestamp(),
  });

  return score;
}

export async function getPendingFriendRequests(uid: string) {
  const requestsSnapshot = await getDocs(query(collection(db, 'friend_requests'), where('toUid', '==', uid), limit(30)));

  const requests = await Promise.all(
    requestsSnapshot.docs.map(async (requestDoc) => {
      const requestData = requestDoc.data();
      if (requestData.status !== 'pending') {
        return null;
      }
      const userSnap = await getDoc(doc(db, 'users', requestData.fromUid));
      return {
        id: requestDoc.id,
        ...requestData,
        user: userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null,
      };
    })
  );

  return requests
    .filter((request) => request?.user)
    .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getSuggestedFriends(uid: string) {
  const [usersSnapshot, friendshipsSnapshot, communitiesSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'users'), limit(40))),
    getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', uid))),
    getDocs(query(collection(db, 'communities'), where('members', 'array-contains', uid), limit(30))),
  ]);

  const activeFriendIds = new Set(
    friendshipsSnapshot.docs
      .map((docSnapshot) => docSnapshot.data())
      .filter((friendship) => friendship.status === 'active')
      .map((friendship) => friendship.users.find((memberId: string) => memberId !== uid))
      .filter(Boolean)
  );

  const myCommunities = communitiesSnapshot.docs.map((communityDoc) => ({
    id: communityDoc.id,
    ...(communityDoc.data() as any),
  }));

  const suggestions = usersSnapshot.docs
    .map((userDoc) => ({ id: userDoc.id, ...(userDoc.data() as any) }))
    .filter((user) => user.id !== uid && !activeFriendIds.has(user.id))
    .map((user) => {
      const sharedCommunities = myCommunities.filter((community) => (community.members || []).includes(user.id));
      const myInterests = new Set<string>();
      myCommunities.forEach((community) => {
        (community.topics || []).forEach((topic: string) => myInterests.add(topic));
      });
      const sharedInterests = (user.interests || []).filter((interest: string) => myInterests.has(interest));
      const score = sharedCommunities.length * 18 + Math.min(sharedInterests.length * 8, 16) + (user.followersCount || 0) * 0.1;

      return {
        ...user,
        suggestionScore: Math.round(score),
        suggestionReasons: [
          sharedCommunities.length > 0 ? `${sharedCommunities.length} shared communities` : null,
          user.work ? `Works at ${user.work}` : null,
        ].filter(Boolean),
        sharedCommunities,
      };
    })
    .filter((user) => user.suggestionScore > 0)
    .sort((a, b) => b.suggestionScore - a.suggestionScore)
    .slice(0, 12);

  return suggestions;
}

export async function getFriendshipMap(uid: string) {
  const friendshipsSnapshot = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', uid)));
  return friendshipsSnapshot.docs.reduce((acc, friendshipDoc) => {
    const friendship = friendshipDoc.data();
    if (friendship.status !== 'active') return acc;

    const friendId = friendship.users.find((memberId: string) => memberId !== uid);
    if (!friendId) return acc;
    acc[friendId] = friendship;
    return acc;
  }, {} as Record<string, any>);
}

export async function searchUsers(queryText: string, excludeUid?: string) {
  const term = queryText.toLowerCase().trim();
  if (!term) return [];

  // Firestore doesn't support case-insensitive contains natively well without extra fields or external services.
  // For now, we fetch a decent batch and filter client-side, but ideally we'd use a search engine or dual-case fields.
  // We'll limit to 50 to keep it performant while being useful.
  
  const usersRef = collection(db, 'users');
  // Simple prefix search as a fallback if client-side filter is too expensive
  const q = query(usersRef, limit(100));
  const snapshot = await getDocs(q);
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() as any }))
    .filter(user => 
      user.id !== excludeUid && (
        user.displayName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.bio?.toLowerCase().includes(term) ||
        user.work?.toLowerCase().includes(term)
      )
    )
    .slice(0, 20);
}
