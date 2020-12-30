﻿using System;
using System.Collections.Immutable;
using PaderConference.Core.Services.Chat;

namespace PaderConference.Core.Domain.Entities
{
    public class ConferenceConfiguration
    {
        /// <summary>
        ///     The name of the conference. May be null
        /// </summary>
        public string? Name { get; set; }

        /// <summary>
        ///     Participant ids of moderators
        /// </summary>
        public IImmutableList<string> Moderators { get; set; } = ImmutableList<string>.Empty;

        /// <summary>
        ///     The type of the conference. Set by the front end to synchronize devices
        /// </summary>
        public string? ConferenceType { get; set; }

        /// <summary>
        ///     The starting time of this conference. If <see cref="ScheduleCron" /> is not null, this is the first time the
        ///     conference starts
        /// </summary>
        public DateTimeOffset? StartTime { get; set; }

        /// <summary>
        ///     A cron string that determines the scheduled time of this conference. The schedule starts after
        ///     <see cref="StartTime" />
        /// </summary>
        public string? ScheduleCron { get; set; }

        /// <summary>
        ///     Chat options
        /// </summary>
        public ChatOptions Chat { get; init; } = new();
    }
}
