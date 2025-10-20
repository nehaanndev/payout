import { NextRequest, NextResponse } from 'next/server';
import { fetchGroupById, getExpenses } from '@/lib/firebaseUtils';
import { calculateRawBalancesMinor } from '@/lib/financeUtils';
import { FRACTION_DIGITS, fromMinor } from '@/lib/currency_core';
import type { CurrencyCode } from '@/lib/currency_core';

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

    const currency = (group.currency ?? 'USD') as CurrencyCode;
    const fractionDigits = FRACTION_DIGITS[currency] ?? 2;

    // Calculate balances in minor units
    const balancesMinor = calculateRawBalancesMinor(group.members, expenses, currency);
    const balances: Record<string, number> = Object.fromEntries(
      Object.entries(balancesMinor).map(([memberId, balanceMinor]) => [
        memberId,
        fromMinor(balanceMinor, currency)
      ])
    );

    // Create human-readable balance summary
    const balanceSummary: string[] = [];
    const memberMap = Object.fromEntries(group.members.map(m => [m.id, m.firstName]));

    for (const [memberId, balanceMinor] of Object.entries(balancesMinor)) {
      const balanceMajor = fromMinor(balanceMinor, currency);
      if (balanceMinor > 0) {
        // This member is owed money
        const memberName = memberMap[memberId];
        balanceSummary.push(`${memberName} is owed ${currency} ${balanceMajor.toFixed(fractionDigits)}`);
      } else if (balanceMinor < 0) {
        // This member owes money
        const memberName = memberMap[memberId];
        balanceSummary.push(`${memberName} owes ${currency} ${Math.abs(balanceMajor).toFixed(fractionDigits)}`);
      }
    }

    // Calculate total owed and total to receive in minor units
    const totalOwedMinor = Object.values(balancesMinor)
      .filter(balance => balance < 0)
      .reduce((sum, balance) => sum + Math.abs(balance), 0);

    const totalToReceiveMinor = Object.values(balancesMinor)
      .filter(balance => balance > 0)
      .reduce((sum, balance) => sum + balance, 0);

    const netBalanceMinor = totalToReceiveMinor - totalOwedMinor;

    // Return balance information
    return NextResponse.json({
      success: true,
      groupId,
      groupName: group.name,
      currency,
      balances,
      balancesMinor,
      balanceSummary: balanceSummary,
      totals: {
        totalOwed: fromMinor(totalOwedMinor, currency).toFixed(fractionDigits),
        totalOwedMinor,
        totalToReceive: fromMinor(totalToReceiveMinor, currency).toFixed(fractionDigits),
        totalToReceiveMinor,
        netBalance: fromMinor(netBalanceMinor, currency).toFixed(fractionDigits),
        netBalanceMinor
      },
      members: group.members.map(m => ({
        id: m.id,
        name: m.firstName,
        balance: balances[m.id] || 0,
        balanceMinor: balancesMinor[m.id] || 0,
        balanceFormatted: `${currency} ${(balances[m.id] || 0).toFixed(fractionDigits)}`
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
