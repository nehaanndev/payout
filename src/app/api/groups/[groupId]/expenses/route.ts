import { NextRequest, NextResponse } from 'next/server';
import { addExpense, fetchGroupById } from '@/lib/firebaseUtils';
import { CurrencyCode } from '@/lib/currency_core';

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const { groupId } = params;
    const body = await request.json();
    const { description, amount, paidBy, splits, createdAt } = body;

    // Validate required fields
    if (!description || !amount || !paidBy || !splits) {
      return NextResponse.json(
        { error: 'Description, amount, paidBy, and splits are required' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const expenseAmount = parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Fetch group to validate it exists and get currency
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Validate splits add up to 100%
    const totalSplit = Object.values(splits).reduce((sum: number, split: any) => sum + parseFloat(split), 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Splits must add up to 100%' },
        { status: 400 }
      );
    }

    // Convert to minor units (cents)
    const amountMinor = Math.round(expenseAmount * 100);
    const splitsMinor: Record<string, number> = {};
    for (const [memberId, split] of Object.entries(splits)) {
      splitsMinor[memberId] = Math.round(parseFloat(split as string) * expenseAmount * 100 / 100);
    }

    // Create expense date
    const expenseDate = createdAt ? new Date(createdAt) : new Date();

    // Add expense to Firebase
    const expenseId = await addExpense(
      groupId,
      description,
      expenseAmount,
      paidBy,
      splits,
      expenseDate,
      amountMinor,
      splitsMinor
    );

    // Return success response
    return NextResponse.json({
      success: true,
      expenseId,
      expense: {
        id: expenseId,
        description,
        amount: expenseAmount,
        paidBy,
        splits,
        createdAt: expenseDate.toISOString(),
        currency: group.currency
      },
      message: `Expense "${description}" of ${group.currency} ${expenseAmount.toFixed(2)} added successfully`
    });

  } catch (error) {
    console.error('Error adding expense:', error);
    return NextResponse.json(
      { error: 'Failed to add expense' },
      { status: 500 }
    );
  }
}
