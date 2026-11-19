#!/usr/bin/env python3
"""Strict timestamp-gated evaluation of frozen pregame NFL probabilities.

CSV columns: game_id,kickoff_utc,prediction_utc,home_win_probability,home_win.
All timestamps must be timezone-aware ISO 8601. Predictions must precede kickoff.
One prediction per game; duplicates are rejected rather than cherry-picked.
"""
import argparse
import csv
import json
import math
from datetime import datetime

def timestamp(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError('timestamps must include timezone')
    return dt

def wilson(correct, total, z=1.959963984540054):
    if not total:
        return None
    p = correct / total
    den = 1 + z*z/total
    center = (p + z*z/(2*total))/den
    half = z * math.sqrt(p*(1-p)/total + z*z/(4*total*total))/den
    return [center-half, center+half]

def evaluate(rows, threshold=0.75):
    if not 0.5 < threshold < 1:
        raise ValueError('threshold must be between 0.5 and 1')
    seen = set()
    total = correct = selected = selected_correct = 0
    brier = loss = 0.0
    for row in rows:
        game = row['game_id'].strip()
        if not game or game in seen:
            raise ValueError('blank or duplicate game_id')
        seen.add(game)
        if timestamp(row['prediction_utc']) >= timestamp(row['kickoff_utc']):
            raise ValueError(f'prediction not pregame: {game}')
        p = float(row['home_win_probability'])
        if not math.isfinite(p) or not 0 < p < 1:
            raise ValueError(f'invalid probability: {game}')
        if row['home_win'] not in ('0', '1'):
            raise ValueError(f'invalid outcome: {game}')
        y = int(row['home_win'])
        hit = int((p >= .5) == bool(y))
        total += 1
        correct += hit
        brier += (p-y)**2
        loss -= y*math.log(p)+(1-y)*math.log1p(-p)
        if max(p, 1-p) >= threshold:
            selected += 1
            selected_correct += hit
    if not total:
        raise ValueError('empty evaluation sample')
    return {'games':total, 'all_game_accuracy':correct/total,
            'all_game_wilson_95':wilson(correct,total),
            'high_confidence_threshold':threshold, 'high_confidence_games':selected,
            'high_confidence_coverage':selected/total,
            'high_confidence_accuracy':selected_correct/selected if selected else None,
            'high_confidence_wilson_95':wilson(selected_correct,selected),
            'brier_score':brier/total, 'log_loss':loss/total,
            'note':'Retrospective evaluation only unless predictions were independently timestamped and frozen before kickoff.'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_path')
    parser.add_argument('--threshold',type=float,default=.75,
                        help='Predeclare before evaluation; default 0.75')
    args = parser.parse_args()
    with open(args.csv_path, newline='', encoding='utf-8') as file:
        print(json.dumps(evaluate(csv.DictReader(file),args.threshold),indent=2))

if __name__ == '__main__':
    main()
