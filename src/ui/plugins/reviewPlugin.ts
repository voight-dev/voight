import * as vscode from 'vscode';
import { SegmentActionPlugin, HighlightSegment, SegmentState } from '../highlighter';
import { Logger } from '../../utils/logger';

/**
 * Plugin to mark blocks as reviewed
 */
export class ReviewPlugin implements SegmentActionPlugin {
    public readonly name = 'Mark as Reviewed';

    public canHandle(segment: HighlightSegment): boolean {
        // Only handle segments that are in DETECTED state
        return segment.state === SegmentState.DETECTED;
    }

    public async execute(segment: HighlightSegment): Promise<void> {
        Logger.debug(`Reviewing segment ${segment.id}`);

        // Mark as reviewed (this would be called via BlockManager)
        vscode.window.showInformationMessage(`Segment ${segment.id} marked as reviewed`);

        // Here you could add more complex logic like:
        // - Open a review form
        // - Add comments
        // - Track who reviewed it
    }
}
