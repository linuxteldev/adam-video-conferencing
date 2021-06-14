import { fabric } from 'fabric';
import { Canvas, IEvent } from 'fabric/fabric-impl';
import { WhiteboardToolBase } from '../whiteboard-tool';

export class TextTool extends WhiteboardToolBase {
   configureCanvas(canvas: Canvas) {
      super.configureCanvas(canvas);

      canvas.isDrawingMode = false;
      canvas.selection = false;

      canvas.forEachObject((o) => {
         o.selectable = false;
         o.evented = false;
      });
   }

   onMouseDown(event: IEvent): void {
      if (event.target) return;

      const canvas = this.getCanvas();
      if (canvas.getActiveObject()) return;

      const pointer = canvas.getPointer(event.e);
      const iText = new fabric.IText('', {
         fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
         fontSize: this.getOptions().fontSize,
         fill: this.getOptions().color,
      });

      const opts = {
         left: pointer.x - (iText.width ?? 0),
         top: pointer.y - (iText.height ?? 0),
      };

      iText.set({
         left: opts.left,
         top: opts.top,
      });

      canvas.setActiveObject(iText);
      canvas.add(iText);

      iText.enterEditing();
      iText.hiddenTextarea?.focus();

      iText.on('editing:exited', () => {
         if (!iText.text) {
            canvas.remove(iText);
            canvas.requestRenderAll();
         }
      });
   }
}
