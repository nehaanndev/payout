import { NextRequest, NextResponse } from 'next/server';
import { fetchGroupById, getExpenses } from '@/lib/firebaseUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    // Fetch group details
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Fetch expenses for the group
    const expenses = await getExpenses(groupId);

    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Return comprehensive group information
    return NextResponse.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        members: group.members,
        expenses: expenses,
        currency: group.currency,
        createdAt: group.createdAt,
        lastUpdated: group.lastUpdated
      },
      summary: {
        totalExpenses,
        totalExpensesFormatted: `${group.currency} ${totalExpenses.toFixed(2)}`,
        memberCount: group.members.length,
        expenseCount: expenses.length
      },
      shareLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.vercel.app'}?group_id=${groupId}`,
      message: `Group "${group.name}" has ${group.members.length} members and ${expenses.length} expenses totaling ${group.currency} ${totalExpenses.toFixed(2)}`
    });

  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group details' },
      { status: 500 }
    );
  }
}


