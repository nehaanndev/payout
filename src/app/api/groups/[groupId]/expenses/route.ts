import { NextRequest, NextResponse } from 'next/server';
import { addExpense, fetchGroupById } from '@/lib/firebaseUtils';
import { FRACTION_DIGITS, splitByWeights, toMinor } from '@/lib/currency_core';
import type { CurrencyCode } from '@/lib/currency_core';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params;
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

    // Fetch group to validate it exists and get currency
    const group = await fetchGroupById(groupId);
    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    const currency = (group.currency ?? 'USD') as CurrencyCode;
    const fractionDigits = FRACTION_DIGITS[currency] ?? 2;

    // Normalize splits to numbers
    const normalizedSplits = Object.entries(splits).reduce<Record<string, number>>((acc, [memberId, split]) => {
      const numericSplit = typeof split === 'number' ? split : parseFloat(String(split));
      acc[memberId] = numericSplit;
      return acc;
    }, {});

    // Validate splits are numeric and add up to 100%
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

    // Add expense to Firebase
    const expenseId = await addExpense(
      groupId,
      description,
      expenseAmount,
      paidBy,
      normalizedSplits,
      expenseDate,
      amountMinor,
      normalizedSplitsMinor
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
        splits: normalizedSplits,
        createdAt: expenseDate.toISOString(),
        currency,
        amountMinor,
        splitsMinor: normalizedSplitsMinor
      },
      message: `Expense "${description}" of ${currency} ${expenseAmount.toFixed(fractionDigits)} added successfully`
    });

  } catch (error) {
    console.error('Error adding expense:', error);
    return NextResponse.json(
      { error: 'Failed to add expense' },
      { status: 500 }
    );
  }
}
