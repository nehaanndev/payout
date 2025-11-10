#!/usr/bin/env python3
"""Train a token-level slot classifier for expense utterances."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator, List, Tuple

import numpy as np
import pandas as pd
from joblib import dump
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

DATA_PATH = Path("data/mind_classifier/token_examples.jsonl")
OUTPUT_DIR = Path("src/lib/mind/classifier/models")
MANUAL_JSON = OUTPUT_DIR / "token_manual.json"
JOBLIB_PATH = OUTPUT_DIR / "token_classifier.joblib"


Example = Tuple[List[str], List[str]]


def read_jsonl(path: Path) -> Iterator[Example]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            payload = json.loads(line)
            tokens = payload["tokens"]
            labels = payload["labels"]
            if len(tokens) != len(labels):
                raise ValueError("Token and label counts differ")
            yield tokens, labels


def word_shape(token: str) -> str:
    shape_chars = []
    for char in token:
        if char.isdigit():
            shape_chars.append("d")
        elif char.isalpha():
            shape_chars.append("X" if char.isupper() else "x")
        else:
            shape_chars.append(char)
    return "".join(shape_chars)


def token_features(tokens: List[str], idx: int) -> dict[str, float]:
    token = tokens[idx]
    lower = token.lower()
    prev_token = tokens[idx - 1].lower() if idx > 0 else "<bos>"
    next_token = tokens[idx + 1].lower() if idx + 1 < len(tokens) else "<eos>"

    features: dict[str, float] = {
        "bias": 1.0,
        f"token={lower}": 1.0,
        f"prefix3={lower[:3]}": 1.0,
        f"suffix3={lower[-3:]}": 1.0,
        f"shape={word_shape(token)}": 1.0,
        f"prev_token={prev_token}": 1.0,
        f"next_token={next_token}": 1.0,
        f"prev_bigram={prev_token}_{lower}": 1.0,
        f"next_bigram={lower}_{next_token}": 1.0,
    }

    if any(char.isdigit() for char in token):
        features["has_digit"] = 1.0
    if any(char in "$₹€£" for char in token):
        features["has_currency_symbol"] = 1.0
    if lower in {"group", "crew", "trip", "team"}:
        features["group_keyword"] = 1.0

    return features


def featurize(examples: List[Example]) -> Tuple[List[dict[str, float]], List[str]]:
    X: List[dict[str, float]] = []
    y: List[str] = []
    for tokens, labels in examples:
        for idx, label in enumerate(labels):
            X.append(token_features(tokens, idx))
            y.append(label)
    return X, y


def export_manual(model: LogisticRegression, vectorizer: DictVectorizer, destination: Path) -> None:
    payload = {
        "vocabulary": vectorizer.vocabulary_,
        "feature_names": vectorizer.get_feature_names_out().tolist(),
        "coef": model.coef_.tolist(),
        "intercept": model.intercept_.tolist(),
        "classes": model.classes_.tolist(),
    }
    with destination.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


def main() -> None:
    examples = list(read_jsonl(DATA_PATH))
    if not examples:
        raise SystemExit("No token examples found.")

    X_dict, y = featurize(examples)
    vectorizer = DictVectorizer(sparse=True)
    X = vectorizer.fit_transform(X_dict)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    clf = LogisticRegression(
        max_iter=2000,
        solver="lbfgs",
        multi_class="multinomial",
    )
    clf.fit(X_train, y_train)

    print("Token classification report:\n", classification_report(y_test, clf.predict(X_test)))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    dump((clf, vectorizer), JOBLIB_PATH)
    export_manual(clf, vectorizer, MANUAL_JSON)
    print("Wrote token classifier to", MANUAL_JSON)


if __name__ == "__main__":
    main()
