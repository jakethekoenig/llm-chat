// chat-components/renderers/ArtifactRenderer.tsx
import React from 'react';
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
    const artifactContent = content.slice(startIndex, endIndex);
    // Ensure content is safe before rendering
    const sanitizedContent = artifactContent
      .replace(/[<>]/g, '') // Remove any HTML tags
      .trim(); // Remove whitespace
    return (
      <span className="artifact-content" data-content={sanitizedContent}>
        {this.subRenderer ? this.subRenderer.render(sanitizedContent, 0, sanitizedContent.length) : <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />}
      </span>
    );
  }
}