import React from 'react';
import DOMPurify from 'dompurify';
import { Renderer } from './Renderer';

interface ArtifactRendererProps {
  tagName: string;
  subRenderer?: Renderer;
}

export class ArtifactRenderer implements Renderer {
  private tagName: string;
  private subRenderer?: Renderer;

  constructor({ tagName, subRenderer }: ArtifactRendererProps) {
    this.tagName = tagName;
    this.subRenderer = subRenderer;
  }

  detectStartSequence(content: string, startIndex: number): [number, number] | null {
    const startTag = `<${this.tagName}>`;
    const index = content.indexOf(startTag, startIndex);
    if (index !== -1) {
      return [index, index + startTag.length];
    }
    return null;
  }

  detectEndSequence(content: string, startIndex: number): [number, number] | null {
    const endTag = `</${this.tagName}>`;
    const index = content.indexOf(endTag, startIndex);
    if (index !== -1) {
      return [index, index + endTag.length];
    }
    return null;
  }

  render(content: string, startIndex: number, endIndex: number): React.ReactNode {
    // Extract content between tags
    const startTag = `<${this.tagName}>`;
    const endTag = `</${this.tagName}>`;
    const contentBetweenTags = content.substring(
      content.indexOf(startTag, startIndex) + startTag.length,
      content.indexOf(endTag, startIndex)
    );
    
    const sanitizedContent = DOMPurify.sanitize(contentBetweenTags.trim(), {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['canvas'],
      ADD_ATTR: ['id']
    });

    return (
      <span className="artifact-content" data-content={sanitizedContent}>
        {this.subRenderer ? (
          this.subRenderer.render(sanitizedContent, 0, sanitizedContent.length)
        ) : (
          <div 
            className="artifact-rendered-content"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
          />
        )}
      </span>
    );
  }
}