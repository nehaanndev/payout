import { NextRequest, NextResponse } from 'next/server';
import { createGroup } from '@/lib/firebaseUtils';
import { Member } from '@/types/group';
import { CurrencyCode } from '@/lib/currency_core';
import { generateUserId } from '@/lib/userUtils';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import { addCorsHeaders, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, creatorName, members, currency = DEFAULT_CURRENCY } = body;

    // Validate required fields
    if (!name || !creatorName) {
      return addCorsHeaders(NextResponse.json(
        { error: 'Group name and creator name are required' },
        { status: 400 }
      ));
    }

    // Create creator member
    const creatorMember: Member = {
      id: generateUserId(),
      firstName: creatorName,
      email: null,
      authProvider: 'anon'
    };

    // Combine creator with provided members
    const allMembers = [creatorMember];
    if (members && Array.isArray(members)) {
      for (const member of members) {
        if (member.firstName && member.firstName !== creatorName) {
          allMembers.push({
            id: generateUserId(),
            firstName: member.firstName,
            email: member.email || null,
            authProvider: 'anon'
          });
        }
      }
    }

    // Create the group
    const groupId = await createGroup(
      name,
      creatorMember.id,
      allMembers,
      currency as CurrencyCode
    );

    // Return success response with group info
    return addCorsHeaders(NextResponse.json({
      success: true,
      groupId,
      groupName: name,
      members: allMembers,
      currency,
      shareLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://payout-n.vercel.app'}?group_id=${groupId}`,
      message: `Group "${name}" created successfully with ${allMembers.length} members`
    }));

  } catch (error) {
    console.error('Error creating group:', error);
    return addCorsHeaders(NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    ));
  }
}
