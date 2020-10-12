﻿using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using PaderConference.Infrastructure.Extensions;
using PaderConference.Infrastructure.Hubs;
using PaderConference.Infrastructure.Sockets;

namespace PaderConference.Infrastructure.Services.Synchronization
{
    public class SynchronizationServiceManager : ConferenceServiceManager<SynchronizationService>
    {
        private readonly IConnectionMapping _connectionMapping;
        private readonly IHubContext<CoreHub> _hubContext;

        public SynchronizationServiceManager(IHubContext<CoreHub> hubContext, IConnectionMapping connectionMapping)
        {
            _hubContext = hubContext;
            _connectionMapping = connectionMapping;
        }

        protected override ValueTask<SynchronizationService> ServiceFactory(string conferenceId,
            IEnumerable<IConferenceServiceManager> services)
        {
            return new SynchronizationService(_hubContext.Clients, conferenceId,
                _connectionMapping).ToValueTask();
        }
    }
}