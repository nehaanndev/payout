import { NextRequest, NextResponse } from 'next/server';
import { updateExpense, deleteExpense, fetchGroupById } from '@/lib/firebaseUtils';
import { FRACTION_DIGITS, splitByWeights, toMinor } from '@/lib/currency_core';
import type { CurrencyCode } from '@/lib/currency_core';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const { groupId, expenseId } = await params;
    const body = await request.json();
    const {
      description,
      amount,
      amountMinor: amountMinorInput,
      paidBy,
      splits,
      splitsMinor: splitsMinorInput,
      createdAt
    } = body;

    // Validate required fields
    if (!description || !amount || !paidBy || !splits) {
      return NextResponse.json(
        { error: 'Description, amount, paidBy, and splits are required' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const expenseAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Validate splits add up to 100%
    const normalizedSplits = Object.entries(splits).reduce<Record<string, number>>((acc, [memberId, split]) => {
      const numericSplit = typeof split === 'number' ? split : parseFloat(String(split));
      acc[memberId] = numericSplit;
      return acc;
    }, {});

    const hasInvalidSplit = Object.values(normalizedSplits).some(splitValue => Number.isNaN(splitValue));
    if (hasInvalidSplit) {
      return NextResponse.json(
        { error: 'Splits must be valid numbers' },
        { status: 400 }
      );
    }
    const totalSplit = Object.values(normalizedSplits).reduce((sum, splitValue) => sum + splitValue, 0);
    if (Math.abs(totalSplit - 100) > 0.01) {
      return NextResponse.json(
        { error: 'Splits must add up to 100%' },
        { status: 400 }
      );
    }

    // Fetch group to validate it exists
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    const currency = (group.currency ?? 'USD') as CurrencyCode;
    const fractionDigits = FRACTION_DIGITS[currency] ?? 2;

    // Determine amounts in minor units
    const amountMinor = typeof amountMinorInput === 'number'
      ? amountMinorInput
      : toMinor(expenseAmount, currency);

    const normalizedSplitsMinor = splitsMinorInput && Object.keys(splitsMinorInput).length > 0
      ? Object.entries(splitsMinorInput).reduce<Record<string, number>>((acc, [memberId, value]) => {
          acc[memberId] = typeof value === 'number' ? value : parseFloat(String(value));
          return acc;
        }, {})
      : splitByWeights(amountMinor, normalizedSplits);

    // Create expense date
    const expenseDate = createdAt ? new Date(createdAt) : new Date();

    // Update expense in Firebase
    await updateExpense(groupId, expenseId, {
      description,
      amount: expenseAmount,
      paidBy,
      splits: normalizedSplits,
      createdAt: expenseDate,
      amountMinor,
      splitsMinor: normalizedSplitsMinor,
    });

    // Return success response
    return NextResponse.json({
      success: true,
      expenseId,
      expense: {
        id: expenseId,
        description,
        amount: expenseAmount,
        paidBy,
        splits: normalizedSplits,
        createdAt: expenseDate.toISOString(),
        currency,
        amountMinor,
        splitsMinor: normalizedSplitsMinor,
      },
      message: `Expense "${description}" updated successfully for ${currency} ${expenseAmount.toFixed(fractionDigits)}`
    });

  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: 'Failed to update expense' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; expenseId: string }> }
) {
  try {
    const { groupId, expenseId } = await params;

    // Fetch group to validate it exists
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    // Delete expense from Firebase
    await deleteExpense(groupId, expenseId);

    // Return success response
    return NextResponse.json({
      success: true,
      expenseId,
      message: `Expense ${expenseId} deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: 'Failed to delete expense' },
      { status: 500 }
    );
  }
}
