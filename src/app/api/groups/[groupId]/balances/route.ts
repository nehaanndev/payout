import { NextRequest, NextResponse } from 'next/server';
import { fetchGroupById, getExpenses } from '@/lib/firebaseUtils';
import { calculateRawBalances } from '@/lib/financeUtils';

export async function GET(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;

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

    // Calculate balances
    const balances = calculateRawBalances(group.members, expenses);

    // Create human-readable balance summary
    const balanceSummary: string[] = [];
    const memberMap = Object.fromEntries(group.members.map(m => [m.id, m.firstName]));

    for (const [memberId, balance] of Object.entries(balances)) {
      if (balance > 0) {
        // This member is owed money
        const memberName = memberMap[memberId];
        balanceSummary.push(`${memberName} is owed ${group.currency} ${balance.toFixed(2)}`);
      } else if (balance < 0) {
        // This member owes money
        const memberName = memberMap[memberId];
        balanceSummary.push(`${memberName} owes ${group.currency} ${Math.abs(balance).toFixed(2)}`);
      }
    }

    // Calculate total owed and total to receive
    const totalOwed = Object.values(balances)
      .filter(balance => balance < 0)
      .reduce((sum, balance) => sum + Math.abs(balance), 0);
    
    const totalToReceive = Object.values(balances)
      .filter(balance => balance > 0)
      .reduce((sum, balance) => sum + balance, 0);

    // Return balance information
    return NextResponse.json({
      success: true,
      groupId,
      groupName: group.name,
      currency: group.currency,
      balances: balances,
      balanceSummary: balanceSummary,
      totals: {
        totalOwed: totalOwed.toFixed(2),
        totalToReceive: totalToReceive.toFixed(2),
        netBalance: (totalToReceive - totalOwed).toFixed(2)
      },
      members: group.members.map(m => ({
        id: m.id,
        name: m.firstName,
        balance: balances[m.id] || 0,
        balanceFormatted: `${group.currency} ${(balances[m.id] || 0).toFixed(2)}`
      })),
      message: balanceSummary.length > 0 
        ? balanceSummary.join(', ')
        : 'All balances are settled!'
    });

  } catch (error) {
    console.error('Error fetching balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balances' },
      { status: 500 }
    );
  }
}
