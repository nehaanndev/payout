import { NextRequest, NextResponse } from 'next/server';
import { updateGroupMembers, fetchGroupById } from '@/lib/firebaseUtils';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { groupId: string; memberId: string } }
) {
  try {
    const { groupId, memberId } = params;

    // Fetch existing group
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Find the member to remove
    const memberToRemove = group.members.find(m => m.id === memberId);
    if (!memberToRemove) {
      return NextResponse.json(
        { error: 'Member not found in this group' },
        { status: 404 }
      );
    }

    // Check if this is the last member
    if (group.members.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last member from a group' },
        { status: 400 }
      );
    }

    // Remove member from group
    const updatedMembers = group.members.filter(m => m.id !== memberId);
    await updateGroupMembers(groupId, updatedMembers);

    // Return success response
    return NextResponse.json({
      success: true,
      removedMember: memberToRemove,
      groupId,
      groupName: group.name,
      remainingMembers: updatedMembers.length,
      message: `Member "${memberToRemove.firstName}" removed successfully from group "${group.name}"`
    });

  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}


