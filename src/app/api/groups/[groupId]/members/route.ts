import { NextRequest, NextResponse } from 'next/server';
import { updateGroupMembers, fetchGroupById } from '@/lib/firebaseUtils';
import { Member } from '@/types/group';
import { generateUserId } from '@/lib/userUtils';

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;
    const body = await request.json();
    const { firstName, email } = body;

    // Validate required fields
    if (!firstName) {
      return NextResponse.json(
        { error: 'First name is required' },
        { status: 400 }
      );
    }

    // Fetch existing group
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Check if member already exists
    const existingMember = group.members.find(
      m => m.firstName.toLowerCase() === firstName.toLowerCase() || 
           (email && m.email === email)
    );

    if (existingMember) {
      return NextResponse.json(
        { error: `Member "${firstName}" already exists in this group` },
        { status: 400 }
      );
    }

    // Create new member
    const newMember: Member = {
      id: generateUserId(),
      firstName: firstName.trim(),
      email: email?.trim() || null,
      authProvider: 'anon'
    };

    // Add member to group
    const updatedMembers = [...group.members, newMember];
    await updateGroupMembers(groupId, updatedMembers);

    // Return success response
    return NextResponse.json({
      success: true,
      member: newMember,
      groupId,
      groupName: group.name,
      totalMembers: updatedMembers.length,
      message: `Member "${firstName}" added successfully to group "${group.name}"`
    });

  } catch (error) {
    console.error('Error adding member:', error);
    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    );
  }
}


