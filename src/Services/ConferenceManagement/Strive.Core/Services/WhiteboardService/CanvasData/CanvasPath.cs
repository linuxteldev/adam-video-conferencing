﻿#pragma warning disable 8618

using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Strive.Core.Services.WhiteboardService.CanvasData
{
    public record CanvasPath : CanvasObject
    {
        public IReadOnlyList<JValue[]> Path { get; set; }
    }
}
