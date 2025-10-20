import { NextRequest, NextResponse } from 'next/server';
import { fetchGroupById, getExpenses } from '@/lib/firebaseUtils';
import { FRACTION_DIGITS, fromMinor, toMinor } from '@/lib/currency_core';
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

    // Calculate total expenses using minor units when available
    const totalExpensesMinor = expenses.reduce((sum, expense) => {
      if (typeof expense.amountMinor === 'number') {
        return sum + expense.amountMinor;
      }
      return sum + toMinor(expense.amount, currency);
    }, 0);
    const totalExpenses = fromMinor(totalExpensesMinor, currency);

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
        currency,
        totalExpenses,
        totalExpensesMinor,
        totalExpensesFormatted: `${currency} ${totalExpenses.toFixed(fractionDigits)}`,
        memberCount: group.members.length,
        expenseCount: expenses.length
      },
      shareLink: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://yourdomain.vercel.app'}?group_id=${groupId}`,
      message: `Group "${group.name}" has ${group.members.length} members and ${expenses.length} expenses totaling ${currency} ${totalExpenses.toFixed(fractionDigits)}`
    });

  } catch (error) {
    console.error('Error fetching group:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group details' },
      { status: 500 }
    );
  }
}

