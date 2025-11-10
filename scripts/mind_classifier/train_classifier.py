#!/usr/bin/env python3
"""Trains a lightweight TF-IDF + Logistic Regression intent classifier.

Outputs both joblib artifacts (for experimentation) and JSON weights for
browser-side inference with a custom TF-IDF implementation.
"""

from __future__ import annotations

import argparse
import json
from numbers import Number
from pathlib import Path
from typing import Iterator

import pandas as pd
from joblib import dump
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder


def read_jsonl(path: Path) -> Iterator[dict]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def export_pipeline(pipe: Pipeline, destination: Path) -> None:
    vec: TfidfVectorizer = pipe.named_steps["tfidf"]
    clf: LogisticRegression = pipe.named_steps["clf"]

    vocabulary = {token: int(idx) for token, idx in vec.vocabulary_.items()}
    classes = [
        (int(cls) if isinstance(cls, Number) else cls) for cls in clf.classes_.tolist()
    ]

    payload = {
        "vocabulary": vocabulary,
        "idf": vec.idf_.tolist(),
        "ngram_range": list(vec.ngram_range),
        "max_features": vec.max_features,
        "stop_words": sorted(vec.stop_words_) if getattr(vec, "stop_words_", None) else None,
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "classes": classes,
    }

    with destination.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)


def ensure_output_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        type=Path,
        default=Path("data/mind_classifier/data.jsonl"),
        help="Path to the labeled jsonl data file.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("src/lib/mind/classifier/models"),
        help="Directory where artifacts will be written.",
    )
    parser.add_argument(
        "--max-features",
        type=int,
        default=8000,
        help="Maximum vocabulary size for TF-IDF.",
    )
    parser.add_argument(
        "--min-df",
        type=int,
        default=1,
        help="Minimum document frequency for tokens.",
    )
    return parser.parse_args()


def train_binary(df: pd.DataFrame, max_features: int, min_df: int) -> Pipeline:
    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["label_bin"],
        test_size=0.2,
        random_state=42,
        stratify=df["label_bin"],
    )

    pipe = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=min_df,
                    max_features=max_features,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    solver="lbfgs",
                ),
            ),
        ]
    )

    pipe.fit(X_train, y_train)
    print("Binary report:\n", classification_report(y_test, pipe.predict(X_test)))
    return pipe


def train_intent(df: pd.DataFrame, max_features: int, min_df: int) -> tuple[Pipeline, LabelEncoder]:
    encoder = LabelEncoder()
    df["intent_y"] = encoder.fit_transform(df["intent"])

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"],
        df["intent_y"],
        test_size=0.2,
        random_state=42,
        stratify=df["intent_y"],
    )

    pipe = Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    ngram_range=(1, 2),
                    min_df=min_df,
                    max_features=max_features,
                ),
            ),
            (
                "clf",
                LogisticRegression(
                    max_iter=2000,
                    solver="lbfgs",
                ),
            ),
        ]
    )

    pipe.fit(X_train, y_train)
    print(
        "Intent report:\n",
        classification_report(
            y_test,
            pipe.predict(X_test),
            target_names=encoder.classes_,
        ),
    )
    return pipe, encoder


def main() -> None:
    args = parse_args()

    if not args.data.exists():
        raise SystemExit(f"Data file not found: {args.data}")

    rows = list(read_jsonl(args.data))
    if not rows:
        raise SystemExit("No data rows found. Provide labeled examples first.")

    df = pd.DataFrame(rows)
    if "text" not in df or "label" not in df:
        raise SystemExit("Data must include 'text' and 'label' fields.")

    df["label_bin"] = (df["label"].str.lower() == "command").astype(int)

    ensure_output_dir(args.out)

    bin_pipe = train_binary(df, args.max_features, args.min_df)
    dump(bin_pipe, args.out / "bin_classifier.joblib")
    export_pipeline(bin_pipe, args.out / "bin_manual.json")

    cmd_df = df[df["label_bin"] == 1].copy()
    intent_pipe = None
    encoder = None
    if "intent" in cmd_df and not cmd_df["intent"].isna().all():
        intent_pipe, encoder = train_intent(cmd_df, args.max_features, args.min_df)
        dump(intent_pipe, args.out / "intent_classifier.joblib")
        export_pipeline(intent_pipe, args.out / "intent_manual.json")
        dump(list(encoder.classes_), args.out / "intent_classes.joblib")
        with (args.out / "intent_classes.json").open("w", encoding="utf-8") as handle:
            json.dump(list(encoder.classes_), handle, ensure_ascii=False)

    print("Artifacts written to", args.out)


if __name__ == "__main__":
    main()
