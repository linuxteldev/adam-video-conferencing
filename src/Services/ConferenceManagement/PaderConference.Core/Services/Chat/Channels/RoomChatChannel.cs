﻿namespace PaderConference.Core.Services.Chat.Channels
{
    public record RoomChatChannel(string RoomId) : ChatChannel
    {
        public override ChatChannelType Type { get; } = ChatChannelType.Room;
    }
}
